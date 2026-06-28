import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../database';
import { verifyGoogleToken, signSession, requireAuth, SessionAccount, SUPERUSER_EMAIL } from '../auth';
import { requireClinic, attachClinic, isSuperAdminHost } from '../tenant';
import { recordActivity } from '../audit';

const router = Router();

// ── Auxiliares ──────────────────────────────────────────────────────────────

async function getSuperuserAccount(): Promise<{ id: number; email: string; name: string | null } | null> {
  const r = await pool.query(
    `SELECT id, email, name FROM accounts WHERE email = $1 AND clinic_id IS NULL`,
    [SUPERUSER_EMAIL]
  );
  return r.rows[0] || null;
}

// Construye una sesión SOMBRA: el super admin actuando como admin de una clínica.
// No tiene fila propia en la tabla accounts de esa clínica; las acciones se
// registran como "internal" en la bitácora.
async function buildShadowSession(clinicId: number): Promise<SessionAccount | null> {
  const sup = await getSuperuserAccount();
  if (!sup) return null;
  return {
    id: sup.id,
    email: sup.email,
    name: sup.name,
    role: 'clinic_admin',
    clinic_id: clinicId,
    is_shadow: true,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// LOGIN DENTRO DE UNA CLÍNICA (subdominio <slug>.odontiacloud.com)
// ════════════════════════════════════════════════════════════════════════════

// Google login DESDE una clínica: requiere conocer la clínica.
router.post('/google', requireClinic, async (req: Request, res: Response) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: 'Falta el token de Google' });

  let profile;
  try {
    profile = await verifyGoogleToken(credential);
  } catch (e: any) {
    return res.status(401).json({ error: e.message || 'No se pudo verificar Google' });
  }
  const { email, name, sub } = profile;
  const preferredLang = req.body.language === 'en' ? 'en' : 'es';
  const clinic = req.clinic!;

  // Caso especial: super admin entrando a una clínica → sesión SOMBRA
  if (email === SUPERUSER_EMAIL) {
    const session = await buildShadowSession(clinic.id);
    if (!session) return res.status(500).json({ error: 'Configuración inválida del super admin' });
    const token = signSession(session);
    // Marcamos su entrada en la bitácora INTERNA (no visible al admin de la clínica)
    recordActivity({
      clinicId: clinic.id,
      accountId: session.id,
      accountEmail: session.email,
      accountName: session.name,
      action: 'Inició sesión',
      entity: 'Sesión',
      summary: `Super admin entró a la clínica "${clinic.name}"`,
      method: 'POST',
      path: '/api/auth/google',
      statusCode: 200,
      internal: true,
    });
    const account = { ...session, language: preferredLang };
    return res.json({ token, account });
  }

  // Caso normal: busca cuenta DENTRO de la clínica
  const existing = await pool.query(
    'SELECT id, email, name, role, language FROM accounts WHERE email = $1 AND clinic_id = $2',
    [email, clinic.id]
  );
  let account: { id: number; email: string; name: string | null; role: 'superuser' | 'clinic_admin' | 'staff'; language: string };

  if (existing.rows[0]) {
    account = existing.rows[0];
    await pool.query(
      'UPDATE accounts SET google_sub = $1, name = COALESCE(name, $2), last_login = NOW() WHERE id = $3',
      [sub, name, account.id]
    );
  } else {
    // No tiene cuenta en esta clínica: necesita una invitación pendiente
    const invite = await pool.query(
      `SELECT id FROM invitations WHERE email = $1 AND clinic_id = $2 AND status = 'pending'`,
      [email, clinic.id]
    );
    if (!invite.rows[0]) {
      return res.status(403).json({ error: 'Tu correo no tiene invitación a esta clínica.' });
    }
    const created = await pool.query(
      `INSERT INTO accounts (email, name, role, google_sub, language, last_login, clinic_id)
       VALUES ($1, $2, 'staff', $3, $4, NOW(), $5) RETURNING id, email, name, role, language`,
      [email, name, sub, preferredLang, clinic.id]
    );
    account = created.rows[0];
    await pool.query(`UPDATE invitations SET status = 'accepted', accepted_at = NOW() WHERE id = $1`, [invite.rows[0].id]);
  }

  const session: SessionAccount = {
    id: account.id, email: account.email, name: account.name, role: account.role, clinic_id: clinic.id,
  };
  const token = signSession(session);

  recordActivity({
    clinicId: clinic.id,
    accountId: account.id,
    accountEmail: account.email,
    accountName: account.name,
    action: 'Inició sesión',
    entity: 'Sesión',
    summary: 'Inició sesión',
    method: 'POST',
    path: '/api/auth/google',
    statusCode: 200,
  });

  res.json({ token, account: { ...session, language: account.language } });
});

// Consulta pública del correo asociado a un token de invitación
router.get('/invitation/:token', requireClinic, async (req: Request, res: Response) => {
  const r = await pool.query(
    `SELECT email FROM invitations WHERE token = $1 AND status = 'pending' AND clinic_id = $2`,
    [req.params.token, req.clinic!.id]
  );
  if (!r.rows[0]) return res.status(404).json({ error: 'La invitación no es válida o ya fue usada.' });
  res.json({ email: r.rows[0].email });
});

// Crear cuenta con correo + contraseña usando el enlace de invitación
router.post('/register', requireClinic, async (req: Request, res: Response) => {
  const token = (req.body.token || '').trim();
  const password: string = req.body.password || '';
  const name = (req.body.name || '').trim() || null;
  const preferredLang = req.body.language === 'en' ? 'en' : 'es';
  const clinic = req.clinic!;

  if (!token) return res.status(400).json({ error: 'Falta el enlace de invitación.' });
  if (password.length < 8) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });

  const inv = await pool.query(
    `SELECT id, email FROM invitations WHERE token = $1 AND status = 'pending' AND clinic_id = $2`,
    [token, clinic.id]
  );
  if (!inv.rows[0]) return res.status(400).json({ error: 'La invitación no es válida o ya fue usada.' });
  const email: string = inv.rows[0].email;

  const existing = await pool.query(
    'SELECT id FROM accounts WHERE email = $1 AND clinic_id = $2',
    [email, clinic.id]
  );
  if (existing.rows[0]) return res.status(409).json({ error: 'Ese correo ya tiene una cuenta. Inicia sesión.' });

  const passwordHash = await bcrypt.hash(password, 10);
  const created = await pool.query(
    `INSERT INTO accounts (email, name, role, password_hash, language, last_login, clinic_id)
     VALUES ($1, $2, 'staff', $3, $4, NOW(), $5) RETURNING id, email, name, role, language`,
    [email, name, passwordHash, preferredLang, clinic.id]
  );
  const account = created.rows[0];
  await pool.query(`UPDATE invitations SET status = 'accepted', accepted_at = NOW() WHERE id = $1`, [inv.rows[0].id]);

  const session: SessionAccount = {
    id: account.id, email: account.email, name: account.name, role: account.role, clinic_id: clinic.id,
  };
  const sessionToken = signSession(session);

  recordActivity({
    clinicId: clinic.id,
    accountId: account.id,
    accountEmail: account.email,
    accountName: account.name,
    action: 'Creó su cuenta',
    entity: 'Sesión',
    summary: 'Creó su cuenta con correo y contraseña',
    method: 'POST',
    path: '/api/auth/register',
    statusCode: 201,
  });

  res.status(201).json({ token: sessionToken, account: { ...session, language: account.language } });
});

// Iniciar sesión con correo + contraseña dentro de una clínica
router.post('/login', requireClinic, async (req: Request, res: Response) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const password: string = req.body.password || '';
  if (!email || !password) return res.status(400).json({ error: 'Faltan datos.' });
  const clinic = req.clinic!;

  // El super admin no puede iniciar con contraseña en una clínica
  if (email === SUPERUSER_EMAIL) {
    return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
  }

  const r = await pool.query(
    'SELECT id, email, name, role, language, password_hash FROM accounts WHERE email = $1 AND clinic_id = $2',
    [email, clinic.id]
  );
  const row = r.rows[0];
  if (!row || !row.password_hash) return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });

  await pool.query('UPDATE accounts SET last_login = NOW() WHERE id = $1', [row.id]);

  const session: SessionAccount = {
    id: row.id, email: row.email, name: row.name, role: row.role, clinic_id: clinic.id,
  };
  const token = signSession(session);

  recordActivity({
    clinicId: clinic.id,
    accountId: row.id,
    accountEmail: row.email,
    accountName: row.name,
    action: 'Inició sesión',
    entity: 'Sesión',
    summary: 'Inició sesión con correo y contraseña',
    method: 'POST',
    path: '/api/auth/login',
    statusCode: 200,
  });

  res.json({ token, account: { ...session, language: row.language } });
});

// ════════════════════════════════════════════════════════════════════════════
// LOGIN GLOBAL (dominio raíz: odontiacloud.com/login)
// Descubre las clínicas a las que tiene acceso un correo y devuelve
// tokens listos para usar. Si solo tiene una, el frontend entra directo;
// si tiene varias, muestra un selector.
// ════════════════════════════════════════════════════════════════════════════

router.post('/discover', async (req: Request, res: Response) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: 'Falta el token de Google' });

  let profile;
  try { profile = await verifyGoogleToken(credential); }
  catch (e: any) { return res.status(401).json({ error: e.message || 'No se pudo verificar Google' }); }

  // Caso especial: super admin → portal
  if (profile.email === SUPERUSER_EMAIL) {
    const sup = await getSuperuserAccount();
    if (!sup) return res.status(500).json({ error: 'Configuración inválida del super admin' });
    const session: SessionAccount = {
      id: sup.id, email: sup.email, name: sup.name, role: 'superuser', clinic_id: null,
    };
    return res.json({
      super: { token: signSession(session), account: { ...session, language: 'es' } },
    });
  }

  // Busca todas las cuentas de este correo (una por clínica)
  const { rows } = await pool.query(
    `SELECT a.id, a.email, a.name, a.role, a.language, a.clinic_id,
            c.slug AS clinic_slug, c.name AS clinic_name
     FROM accounts a
     JOIN clinics c ON c.id = a.clinic_id
     WHERE a.email = $1
     ORDER BY a.last_login DESC NULLS LAST, c.name ASC`,
    [profile.email]
  );

  if (rows.length === 0) {
    return res.status(403).json({ error: 'Tu correo no está registrado en ninguna clínica.' });
  }

  // Para cada cuenta, firmamos un token y actualizamos last_login
  const clinics = rows.map(r => {
    const session: SessionAccount = {
      id: r.id, email: r.email, name: r.name, role: r.role, clinic_id: r.clinic_id,
    };
    return {
      clinic_id: r.clinic_id,
      clinic_slug: r.clinic_slug,
      clinic_name: r.clinic_name,
      role: r.role,
      token: signSession(session),
      account: { ...session, language: r.language },
    };
  });

  // Marca el inicio en la cuenta más reciente para que la próxima vez aparezca primero
  await pool.query(
    `UPDATE accounts SET last_login = NOW(), google_sub = $1, name = COALESCE(name, $2) WHERE email = $3`,
    [profile.sub, profile.name, profile.email]
  );

  res.json({ clinics });
});

// ════════════════════════════════════════════════════════════════════════════
// LOGIN PARA EL PORTAL DE SUPER ADMIN (superadmin.odontiacloud.com)
// ════════════════════════════════════════════════════════════════════════════

router.post('/super/google', async (req: Request, res: Response) => {
  if (!isSuperAdminHost(req)) return res.status(404).json({ error: 'No encontrado' });
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: 'Falta el token de Google' });

  let profile;
  try { profile = await verifyGoogleToken(credential); }
  catch (e: any) { return res.status(401).json({ error: e.message || 'No se pudo verificar Google' }); }

  if (profile.email !== SUPERUSER_EMAIL) {
    return res.status(403).json({ error: 'Solo el super admin puede entrar.' });
  }
  const sup = await getSuperuserAccount();
  if (!sup) return res.status(500).json({ error: 'Configuración inválida del super admin' });

  const session: SessionAccount = {
    id: sup.id, email: sup.email, name: sup.name, role: 'superuser', clinic_id: null,
  };
  const token = signSession(session);

  recordActivity({
    accountId: sup.id, accountEmail: sup.email, accountName: sup.name,
    action: 'Inició sesión', entity: 'Super admin',
    summary: 'Inició sesión en el portal de super admin',
    method: 'POST', path: '/api/auth/super/google', statusCode: 200,
  });

  res.json({ token, account: { ...session, language: 'es' } });
});

// ════════════════════════════════════════════════════════════════════════════
// SESIÓN ACTUAL
// ════════════════════════════════════════════════════════════════════════════

// Datos de la sesión actual.
// El super admin (clinic_id NULL) lee directo de su fila; las cuentas normales
// leen de su fila + clínica; la sesión sombra no tiene fila → idioma 'es' por defecto.
router.get('/me', requireAuth, attachClinic, async (req: Request, res: Response) => {
  const acc = req.account!;
  let language: 'es' | 'en' = 'es';
  if (acc.clinic_id !== null && !acc.is_shadow && !acc.is_demo_visitor) {
    const r = await pool.query('SELECT language FROM accounts WHERE id = $1 AND clinic_id = $2', [acc.id, acc.clinic_id]);
    if (r.rows[0]) language = r.rows[0].language;
  }
  // Devolvemos también la clínica resuelta del request para que el frontend
  // pueda detectar si la sesión pertenece a OTRA clínica distinta a la del
  // path y cerrarla automáticamente.
  res.json({ account: { ...acc, language }, clinic: req.clinic || null });
});

router.put('/language', requireAuth, async (req: Request, res: Response) => {
  const language = req.body.language === 'en' ? 'en' : req.body.language === 'es' ? 'es' : null;
  if (!language) return res.status(400).json({ error: 'Idioma inválido' });
  const acc = req.account!;
  // El super admin global y las sesiones sombra no persisten idioma por clínica
  if (acc.clinic_id !== null && !acc.is_shadow && !acc.is_demo_visitor) {
    await pool.query('UPDATE accounts SET language = $1 WHERE id = $2 AND clinic_id = $3', [language, acc.id, acc.clinic_id]);
    recordActivity({
      clinicId: acc.clinic_id,
      accountId: acc.id, accountEmail: acc.email, accountName: acc.name,
      action: 'Cambió el idioma', entity: 'Ajustes',
      summary: `Cambió el idioma a ${language === 'en' ? 'Inglés' : 'Español'}`,
      method: 'PUT', path: '/api/auth/language', statusCode: 200,
      internal: acc.is_shadow,
    });
  }
  res.json({ account: { ...acc, language } });
});

export default router;
