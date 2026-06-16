import { Router, Request, Response } from 'express';
import pool from '../database';
import { verifyGoogleToken, signSession, requireAuth, SessionAccount } from '../auth';
import { recordActivity } from '../audit';

const router = Router();

// Login / registro con Google. Solo se permite si:
//  - es el superusuario, o
//  - ya tiene cuenta, o
//  - tiene una invitación pendiente (se acepta automáticamente)
router.post('/google', async (req: Request, res: Response) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: 'Falta el token de Google' });

  let profile;
  try {
    profile = await verifyGoogleToken(credential);
  } catch (e: any) {
    return res.status(401).json({ error: e.message || 'No se pudo verificar Google' });
  }
  const { email, name, sub } = profile;
  // Idioma elegido en la pantalla de login (solo aplica a cuentas nuevas)
  const preferredLang = req.body.language === 'en' ? 'en' : 'es';

  // ¿Ya existe la cuenta?
  const existing = await pool.query('SELECT id, email, name, role, language FROM accounts WHERE email = $1', [email]);
  let account: SessionAccount & { language: string };

  if (existing.rows[0]) {
    account = existing.rows[0];
    await pool.query('UPDATE accounts SET google_sub = $1, name = COALESCE(name, $2), last_login = NOW() WHERE id = $3',
      [sub, name, account.id]);
  } else {
    // No tiene cuenta: necesita una invitación pendiente
    const invite = await pool.query(`SELECT id FROM invitations WHERE email = $1 AND status = 'pending'`, [email]);
    if (!invite.rows[0]) {
      return res.status(403).json({ error: 'Tu correo no tiene una invitación. Pide al administrador que te invite.' });
    }
    const created = await pool.query(
      `INSERT INTO accounts (email, name, role, google_sub, language, last_login)
       VALUES ($1, $2, 'staff', $3, $4, NOW()) RETURNING id, email, name, role, language`,
      [email, name, sub, preferredLang]
    );
    account = created.rows[0];
    await pool.query(`UPDATE invitations SET status = 'accepted', accepted_at = NOW() WHERE id = $1`, [invite.rows[0].id]);
  }

  // El token solo lleva los campos de sesión; el idioma se sirve aparte en el objeto account.
  const { language, ...session } = account;
  const token = signSession(session);

  // Registra el inicio de sesión en la bitácora.
  recordActivity({
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

  res.json({ token, account });
});

// Datos de la sesión actual (el idioma se lee fresco de la BD, no del token)
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const r = await pool.query('SELECT language FROM accounts WHERE id = $1', [req.account!.id]);
  const language = r.rows[0]?.language || 'es';
  res.json({ account: { ...req.account, language } });
});

// Cambiar el idioma preferido del usuario actual
router.put('/language', requireAuth, async (req: Request, res: Response) => {
  const language = req.body.language === 'en' ? 'en' : req.body.language === 'es' ? 'es' : null;
  if (!language) return res.status(400).json({ error: 'Idioma inválido' });
  await pool.query('UPDATE accounts SET language = $1 WHERE id = $2', [language, req.account!.id]);
  recordActivity({
    accountId: req.account!.id,
    accountEmail: req.account!.email,
    accountName: req.account!.name,
    action: 'Cambió el idioma',
    entity: 'Ajustes',
    summary: `Cambió el idioma a ${language === 'en' ? 'Inglés' : 'Español'}`,
    method: 'PUT',
    path: '/api/auth/language',
    statusCode: 200,
  });
  res.json({ account: { ...req.account, language } });
});

export default router;
