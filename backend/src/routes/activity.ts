import { Router, Request, Response } from 'express';
import pool from '../database';
import { requireAuth, requireSuperuser } from '../auth';

const router = Router();

// La bitácora es información sensible: solo el superusuario la consulta.
router.use(requireAuth, requireSuperuser);

// Lista de eventos con filtros opcionales:
//   ?account=correo@x.com   filtra por usuario
//   ?entity=Cita            filtra por módulo
//   ?limit=100              cantidad máxima (por defecto 200)
router.get('/', async (req: Request, res: Response) => {
  const { account, entity } = req.query;
  const limit = Math.min(Number(req.query.limit) || 200, 500);

  const conditions: string[] = [];
  const params: any[] = [];

  if (account) {
    params.push(account);
    conditions.push(`account_email = $${params.length}`);
  }
  if (entity) {
    params.push(entity);
    conditions.push(`entity = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit);

  const { rows } = await pool.query(
    `SELECT * FROM activity_log ${where} ORDER BY created_at DESC LIMIT $${params.length}`,
    params
  );
  res.json(rows);
});

// Lista de usuarios que han generado actividad (para el selector de filtros).
router.get('/accounts', async (_req: Request, res: Response) => {
  const { rows } = await pool.query(
    `SELECT account_email, MAX(account_name) AS account_name, COUNT(*)::int AS events
     FROM activity_log
     WHERE account_email IS NOT NULL
     GROUP BY account_email
     ORDER BY MAX(created_at) DESC`
  );
  res.json(rows);
});

export default router;
