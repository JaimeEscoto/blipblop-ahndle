import { Router, Request, Response } from 'express';
import pool from '../database';
import { requireAuth, requireClinicMember, SUPERUSER_EMAIL } from '../auth';
import { requireClinic } from '../tenant';

const router = Router();

// La bitácora de cada clínica: solo el admin de la clínica la consulta.
// El super admin queda OCULTO (filas internal=true o cuyo correo sea el suyo
// se filtran). Para ver TODO, el super admin usa el portal en /api/super.
router.use(requireClinic, requireAuth, requireClinicMember);

function requireAdmin(req: Request, res: Response, next: any) {
  if (req.account?.role !== 'clinic_admin' && req.account?.role !== 'superuser') {
    return res.status(403).json({ error: 'Solo el administrador puede ver la bitácora' });
  }
  next();
}
router.use(requireAdmin);

// Filtros opcionales: ?account=correo  ?entity=Cita  ?limit=100
router.get('/', async (req: Request, res: Response) => {
  const { account, entity } = req.query;
  const limit = Math.min(Number(req.query.limit) || 200, 500);

  const conditions: string[] = ['clinic_id = $1', 'internal = false', 'account_email IS DISTINCT FROM $2'];
  const params: any[] = [req.clinic!.id, SUPERUSER_EMAIL];

  if (account) {
    params.push(account);
    conditions.push(`account_email = $${params.length}`);
  }
  if (entity) {
    params.push(entity);
    conditions.push(`entity = $${params.length}`);
  }

  params.push(limit);

  const { rows } = await pool.query(
    `SELECT * FROM activity_log WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT $${params.length}`,
    params
  );
  res.json(rows);
});

// Lista de usuarios que han generado actividad EN ESTA clínica (selector de filtros).
router.get('/accounts', async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    `SELECT account_email, MAX(account_name) AS account_name, COUNT(*)::int AS events
     FROM activity_log
     WHERE clinic_id = $1 AND internal = false AND account_email IS NOT NULL AND account_email <> $2
     GROUP BY account_email
     ORDER BY MAX(created_at) DESC`,
    [req.clinic!.id, SUPERUSER_EMAIL]
  );
  res.json(rows);
});

export default router;
