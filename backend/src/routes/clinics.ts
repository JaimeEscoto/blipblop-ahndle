import { Router, Request, Response } from 'express';
import pool from '../database';
import { verifyGoogleToken, signSession, SessionAccount, SUPERUSER_EMAIL } from '../auth';
import { RESERVED_SLUGS } from '../tenant';
import { recordActivity } from '../audit';

const router = Router();

// Reglas del slug: minúsculas, números y guiones; 3-40 caracteres; sin guión al inicio/fin.
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/;

function isValidSlug(s: string): boolean {
  if (!SLUG_RE.test(s)) return false;
  if (RESERVED_SLUGS.has(s)) return false;
  return true;
}

// Comprueba la disponibilidad de un slug ANTES de crear (para validación en vivo).
router.get('/check-slug/:slug', async (req: Request, res: Response) => {
  const slug = (req.params.slug || '').trim().toLowerCase();
  if (!isValidSlug(slug)) {
    return res.json({ available: false, reason: 'invalid' });
  }
  const r = await pool.query('SELECT id FROM clinics WHERE slug = $1', [slug]);
  res.json({ available: !r.rows[0], reason: r.rows[0] ? 'taken' : null });
});

// Crear una clínica: cualquier persona con cuenta de Google puede hacerlo.
// El creador queda como clinic_admin de la clínica recién creada.
router.post('/', async (req: Request, res: Response) => {
  const { credential, slug: rawSlug, name } = req.body;
  const slug = (rawSlug || '').trim().toLowerCase();
  const clinicName = (name || '').trim();

  if (!credential) return res.status(400).json({ error: 'Falta el token de Google' });
  if (!clinicName) return res.status(400).json({ error: 'Falta el nombre de la clínica' });
  if (!isValidSlug(slug)) {
    return res.status(400).json({ error: 'El subdominio debe tener entre 3 y 40 letras minúsculas, números o guiones, y no usar nombres reservados.' });
  }

  // Verifica Google
  let profile;
  try { profile = await verifyGoogleToken(credential); }
  catch (e: any) { return res.status(401).json({ error: e.message || 'No se pudo verificar Google' }); }
  const { email, name: ownerName, sub } = profile;

  // El super admin NO crea clínicas con su correo (su rol es global)
  if (email === SUPERUSER_EMAIL) {
    return res.status(400).json({ error: 'El super admin no puede crear una clínica con su propio correo.' });
  }

  // Slug único
  const taken = await pool.query('SELECT id FROM clinics WHERE slug = $1', [slug]);
  if (taken.rows[0]) return res.status(409).json({ error: 'Ese subdominio ya está en uso. Elige otro.' });

  // Transacción: crea clínica + cuenta admin atómicamente
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const clinicIns = await client.query(
      `INSERT INTO clinics (slug, name, owner_email) VALUES ($1, $2, $3) RETURNING id, slug, name`,
      [slug, clinicName, email]
    );
    const clinic = clinicIns.rows[0];

    const acc = await client.query(
      `INSERT INTO accounts (email, name, role, google_sub, language, last_login, clinic_id)
       VALUES ($1, $2, 'clinic_admin', $3, 'es', NOW(), $4)
       RETURNING id, email, name, role, language`,
      [email, ownerName, sub, clinic.id]
    );
    await client.query('COMMIT');

    const session: SessionAccount = {
      id: acc.rows[0].id, email: acc.rows[0].email, name: acc.rows[0].name,
      role: acc.rows[0].role, clinic_id: clinic.id,
    };
    const token = signSession(session);

    recordActivity({
      clinicId: clinic.id,
      accountId: acc.rows[0].id,
      accountEmail: acc.rows[0].email,
      accountName: acc.rows[0].name,
      action: 'Creó',
      entity: 'Clínica',
      entityId: String(clinic.id),
      summary: `Creó la clínica "${clinicName}" (${slug})`,
      method: 'POST', path: '/api/clinics', statusCode: 201,
    });

    res.status(201).json({
      token,
      account: { ...session, language: 'es' },
      clinic: { id: clinic.id, slug: clinic.slug, name: clinic.name },
    });
  } catch (e: any) {
    await client.query('ROLLBACK');
    if (e.code === '23505') return res.status(409).json({ error: 'Ese subdominio o correo ya está registrado.' });
    console.error('Error al crear clínica:', e);
    res.status(500).json({ error: 'No se pudo crear la clínica' });
  } finally {
    client.release();
  }
});

export default router;
