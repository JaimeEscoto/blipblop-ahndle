import { Router, Request, Response } from 'express';
import pool from '../database';
import { requireAuth } from '../auth';

const router = Router();

// Devuelve la versión vigente (id, version, content). Pública: necesaria en
// el alta de clínica antes de tener sesión.
router.get('/current', async (_req: Request, res: Response) => {
  const r = await pool.query(
    `SELECT id, version, content, effective_from
       FROM terms_versions WHERE is_current = TRUE LIMIT 1`
  );
  if (!r.rows[0]) return res.status(404).json({ error: 'No hay términos publicados' });
  res.json(r.rows[0]);
});

// Indica si la sesión actual ya aceptó la versión vigente.
router.get('/status', requireAuth, async (req: Request, res: Response) => {
  const email = req.account!.email;
  const cur = await pool.query(`SELECT id, version FROM terms_versions WHERE is_current = TRUE LIMIT 1`);
  if (!cur.rows[0]) return res.json({ accepted: true, current: null }); // sin términos → no bloquea
  const current = cur.rows[0];
  const acc = await pool.query(
    `SELECT id, accepted_at FROM terms_acceptances
      WHERE user_email = $1 AND terms_version_id = $2 LIMIT 1`,
    [email, current.id]
  );
  res.json({
    accepted: !!acc.rows[0],
    current: { id: current.id, version: current.version },
    accepted_at: acc.rows[0]?.accepted_at || null,
  });
});

// Registra la aceptación de los términos vigentes por la sesión actual.
router.post('/accept', requireAuth, async (req: Request, res: Response) => {
  const account = req.account!;
  const cur = await pool.query(`SELECT id FROM terms_versions WHERE is_current = TRUE LIMIT 1`);
  if (!cur.rows[0]) return res.status(404).json({ error: 'No hay términos publicados' });
  const versionId = cur.rows[0].id;

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.ip || null;
  const ua = req.headers['user-agent'] || null;

  await pool.query(
    `INSERT INTO terms_acceptances (clinic_id, user_email, terms_version_id, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5)`,
    [account.clinic_id, account.email, versionId, ip, ua]
  );
  res.status(201).json({ accepted: true, terms_version_id: versionId });
});

export default router;
