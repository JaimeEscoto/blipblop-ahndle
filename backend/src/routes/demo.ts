import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import pool from '../database';
import { signSession, SessionAccount } from '../auth';
import { recordActivity } from '../audit';

const router = Router();

// Path al seed que se re-ejecuta para resetear el sandbox demo.
// Vive fuera del bundle compilado, así que apuntamos al repo desde dist/cwd.
const SEED_PATH = path.resolve(process.cwd(), '..', 'piloto_clinicas', 'seed_dental_sur.sql');
const SEED_PATH_FALLBACK = path.resolve(process.cwd(), 'piloto_clinicas', 'seed_dental_sur.sql');

async function loadSeed(): Promise<string> {
  try {
    return await fs.readFile(SEED_PATH, 'utf8');
  } catch {
    return await fs.readFile(SEED_PATH_FALLBACK, 'utf8');
  }
}

// ── POST /api/demo/:slug/enter ─────────────────────────────────────────
// Valida que la clínica sea demo y que el token coincida con el de la URL.
// A cambio del nombre del visitante mintea un JWT de sesión scope-clinic.
router.post('/:slug/enter', async (req: Request, res: Response) => {
  const { token, visitor_name } = req.body;
  const slug = String(req.params.slug || '').toLowerCase();

  const cleanName = String(visitor_name || '').trim().slice(0, 60);
  if (cleanName.length < 2) {
    return res.status(400).json({ error: 'Introduce tu nombre para entrar' });
  }
  if (!token) return res.status(400).json({ error: 'Token de demo requerido' });

  const { rows } = await pool.query(
    'SELECT id, slug, name, is_demo, demo_token FROM clinics WHERE slug = $1',
    [slug]
  );
  const clinic = rows[0];
  if (!clinic || !clinic.is_demo || !clinic.demo_token || clinic.demo_token !== token) {
    return res.status(404).json({ error: 'Demo no encontrada o token inválido' });
  }

  const session: SessionAccount = {
    id: 0,
    email: 'demo-visitor',
    name: cleanName,
    role: 'clinic_admin',
    clinic_id: clinic.id,
    is_demo_visitor: true,
  };
  const jwtToken = signSession(session);

  // Registra la visita en la bitácora para que el dueño de la clínica
  // (cuando entre con su cuenta real) pueda ver quién pasó por la demo.
  recordActivity({
    clinicId: clinic.id,
    accountId: null,
    accountEmail: 'demo-visitor',
    accountName: cleanName,
    action: 'demo.enter',
    entity: 'demo',
    entityId: slug,
    summary: `${cleanName} entró a la demo`,
    method: 'POST',
    path: req.originalUrl,
    statusCode: 200,
    details: null,
    internal: false,
  }).catch(() => {});

  res.json({
    token: jwtToken,
    account: { ...session, language: 'es' as const },
    clinic: { id: clinic.id, slug: clinic.slug, name: clinic.name, owner_email: null, created_at: new Date().toISOString() },
  });
});

// ── POST /api/demo/:slug/reset ─────────────────────────────────────────
// Cualquier visitante puede resetear el sandbox compartido si quedó sucio.
// Re-ejecuta el archivo seed_dental_sur.sql (idempotente: borra la clínica
// con cascada y la vuelve a crear).
router.post('/:slug/reset', async (req: Request, res: Response) => {
  const slug = String(req.params.slug || '').toLowerCase();
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token de demo requerido' });

  const { rows } = await pool.query(
    'SELECT id, is_demo, demo_token FROM clinics WHERE slug = $1',
    [slug]
  );
  const clinic = rows[0];
  if (!clinic || !clinic.is_demo || !clinic.demo_token || clinic.demo_token !== token) {
    return res.status(404).json({ error: 'Demo no encontrada o token inválido' });
  }

  let sql: string;
  try {
    sql = await loadSeed();
  } catch (e: any) {
    console.error('No se encontró el seed de la demo:', e);
    return res.status(500).json({ error: 'No se encontró el seed de la demo' });
  }

  try {
    await pool.query(sql);
    res.json({ ok: true });
  } catch (e: any) {
    console.error('Error reseteando demo:', e);
    res.status(500).json({ error: e.message || 'No se pudo resetear la demo' });
  }
});

export default router;
