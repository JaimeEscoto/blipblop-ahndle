import { Router, Request, Response } from 'express';
import pool from '../database';
import { requireAuth, requireSuperAdminPortal } from '../auth';
import { isSuperAdminHost } from '../tenant';
import { PER_CLINIC_LIMIT, GLOBAL_LIMIT } from './attachments';

const router = Router();

// Hard gate: el portal de super admin SOLO se sirve desde el host superadmin.
router.use((req: Request, res: Response, next) => {
  if (!isSuperAdminHost(req)) return res.status(404).json({ error: 'No encontrado' });
  next();
});
router.use(requireAuth, requireSuperAdminPortal);

// Lista de clínicas con métricas básicas (sin tocar datos clínicos)
router.get('/clinics', async (_req: Request, res: Response) => {
  const { rows } = await pool.query(`
    SELECT c.id, c.slug, c.name, c.owner_email, c.created_at,
      (SELECT COUNT(*)::int FROM accounts a WHERE a.clinic_id = c.id) AS account_count,
      (SELECT COUNT(*)::int FROM users u WHERE u.clinic_id = c.id) AS patient_count,
      (SELECT COUNT(*)::int FROM appointments ap WHERE ap.clinic_id = c.id) AS appointment_count,
      (SELECT MAX(created_at) FROM activity_log al WHERE al.clinic_id = c.id) AS last_activity_at
    FROM clinics c
    ORDER BY c.created_at DESC
  `);
  res.json(rows);
});

// Actividad consolidada de TODAS las clínicas (incluye eventos internos del super admin)
router.get('/activity', async (req: Request, res: Response) => {
  const { clinic_id, account, entity } = req.query;
  const limit = Math.min(Number(req.query.limit) || 200, 500);

  const conditions: string[] = [];
  const params: any[] = [];

  if (clinic_id) {
    params.push(clinic_id);
    conditions.push(`al.clinic_id = $${params.length}`);
  }
  if (account) {
    params.push(account);
    conditions.push(`al.account_email = $${params.length}`);
  }
  if (entity) {
    params.push(entity);
    conditions.push(`al.entity = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit);

  const { rows } = await pool.query(
    `SELECT al.*, c.slug AS clinic_slug, c.name AS clinic_name
     FROM activity_log al
     LEFT JOIN clinics c ON c.id = al.clinic_id
     ${where}
     ORDER BY al.created_at DESC
     LIMIT $${params.length}`,
    params
  );
  res.json(rows);
});

// Uso de almacenamiento: total + por clínica. Para mostrar la barra de cuota
// y alertar cuando se alcance el límite global.
router.get('/storage', async (_req: Request, res: Response) => {
  const { rows: per } = await pool.query(`
    SELECT c.id AS clinic_id, c.slug, c.name,
      COALESCE(SUM(a.size_bytes), 0)::bigint AS used,
      COUNT(a.id)::int AS files
    FROM clinics c
    LEFT JOIN attachments a ON a.clinic_id = c.id
    GROUP BY c.id, c.slug, c.name
    ORDER BY used DESC, c.name ASC
  `);
  const clinics = per.map(r => ({
    clinic_id: Number(r.clinic_id),
    slug: r.slug,
    name: r.name,
    used: Number(r.used),
    files: r.files,
    limit: PER_CLINIC_LIMIT,
    over_limit: Number(r.used) > PER_CLINIC_LIMIT,
  }));
  const totalUsed = clinics.reduce((acc, c) => acc + c.used, 0);
  res.json({
    global_used: totalUsed,
    global_limit: GLOBAL_LIMIT,
    global_over: totalUsed > GLOBAL_LIMIT,
    clinics,
  });
});

export default router;
