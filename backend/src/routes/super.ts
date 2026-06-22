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

// Tráfico del sitio público: resumen por fuente/país/navegador + visitas recientes.
router.get('/visits', async (req: Request, res: Response) => {
  const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
  const limit = Math.min(Number(req.query.limit) || 200, 1000);
  const since = `NOW() - INTERVAL '${days} days'`;

  const [totals, bySource, byCountry, byBrowser, byOs, byDevice, recent, daily] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS visits, COUNT(DISTINCT session_id)::int AS sessions
                FROM visits WHERE created_at >= ${since}`),
    pool.query(`SELECT COALESCE(referrer_source,'Directo') AS source, COUNT(*)::int AS visits
                FROM visits WHERE created_at >= ${since}
                GROUP BY source ORDER BY visits DESC LIMIT 20`),
    pool.query(`SELECT COALESCE(country,'Desconocido') AS country, country_code, COUNT(*)::int AS visits
                FROM visits WHERE created_at >= ${since}
                GROUP BY country, country_code ORDER BY visits DESC LIMIT 20`),
    pool.query(`SELECT COALESCE(browser,'Desconocido') AS browser, COUNT(*)::int AS visits
                FROM visits WHERE created_at >= ${since}
                GROUP BY browser ORDER BY visits DESC LIMIT 20`),
    pool.query(`SELECT COALESCE(os,'Desconocido') AS os, COUNT(*)::int AS visits
                FROM visits WHERE created_at >= ${since}
                GROUP BY os ORDER BY visits DESC LIMIT 20`),
    pool.query(`SELECT COALESCE(device,'Desconocido') AS device, COUNT(*)::int AS visits
                FROM visits WHERE created_at >= ${since}
                GROUP BY device ORDER BY visits DESC`),
    pool.query(
      `SELECT id, created_at, path, referrer, referrer_source,
              utm_source, utm_medium, utm_campaign,
              country, country_code, region, city,
              browser, os, device
       FROM visits ORDER BY created_at DESC LIMIT $1`,
      [limit]
    ),
    pool.query(`SELECT DATE_TRUNC('day', created_at) AS day, COUNT(*)::int AS visits
                FROM visits WHERE created_at >= ${since}
                GROUP BY day ORDER BY day ASC`),
  ]);

  res.json({
    days,
    total_visits: totals.rows[0]?.visits ?? 0,
    total_sessions: totals.rows[0]?.sessions ?? 0,
    by_source: bySource.rows,
    by_country: byCountry.rows,
    by_browser: byBrowser.rows,
    by_os: byOs.rows,
    by_device: byDevice.rows,
    daily: daily.rows,
    recent: recent.rows,
  });
});

export default router;
