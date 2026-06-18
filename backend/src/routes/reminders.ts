import { Router, Request, Response } from 'express';
import pool from '../database';
import { requireAuth, requireClinicMember } from '../auth';
import { requireClinic } from '../tenant';

const router = Router();
router.use(requireClinic, requireAuth, requireClinicMember);

router.get('/', async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    `SELECT r.*, u.name as user_name, u.phone as user_phone,
       TO_CHAR(r.date,'YYYY-MM-DD') as date,
       TO_CHAR(r.time,'HH24:MI') as time
     FROM reminders r
     LEFT JOIN users u ON r.user_id = u.id
     WHERE r.clinic_id = $1
     ORDER BY r.date ASC, r.time ASC`,
    [req.clinic!.id]
  );
  res.json(rows);
});

router.post('/', async (req: Request, res: Response) => {
  const { title, description, date, time, type, user_id } = req.body;
  if (!title || !date) return res.status(400).json({ error: 'Título y fecha son requeridos' });
  const { rows } = await pool.query(
    `INSERT INTO reminders (title, description, date, time, type, user_id, clinic_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [title, description || null, date, time || null, type || 'task', user_id || null, req.clinic!.id]
  );
  const { rows: result } = await pool.query(
    `SELECT r.*, u.name as user_name, u.phone as user_phone,
       TO_CHAR(r.date,'YYYY-MM-DD') as date, TO_CHAR(r.time,'HH24:MI') as time
     FROM reminders r LEFT JOIN users u ON r.user_id = u.id WHERE r.id=$1`,
    [rows[0].id]
  );
  res.status(201).json(result[0]);
});

router.patch('/:id/status', async (req: Request, res: Response) => {
  const { status } = req.body;
  if (!['pending', 'done'].includes(status)) return res.status(400).json({ error: 'Estado inválido' });
  const before = await pool.query(
    `SELECT r.*, u.name as user_name, u.phone as user_phone,
       TO_CHAR(r.date,'YYYY-MM-DD') as date, TO_CHAR(r.time,'HH24:MI') as time
     FROM reminders r LEFT JOIN users u ON r.user_id = u.id WHERE r.id=$1 AND r.clinic_id=$2`,
    [req.params.id, req.clinic!.id]
  );
  req.auditBefore = before.rows[0] || null;
  const { rows } = await pool.query(
    'UPDATE reminders SET status=$1 WHERE id=$2 AND clinic_id=$3 RETURNING id', [status, req.params.id, req.clinic!.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Recordatorio no encontrado' });
  const { rows: result } = await pool.query(
    `SELECT r.*, u.name as user_name, u.phone as user_phone,
       TO_CHAR(r.date,'YYYY-MM-DD') as date, TO_CHAR(r.time,'HH24:MI') as time
     FROM reminders r LEFT JOIN users u ON r.user_id = u.id WHERE r.id=$1`,
    [rows[0].id]
  );
  res.json(result[0]);
});

router.delete('/:id', async (req: Request, res: Response) => {
  const { rows } = await pool.query('DELETE FROM reminders WHERE id=$1 AND clinic_id=$2 RETURNING *', [req.params.id, req.clinic!.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Recordatorio no encontrado' });
  res.json(rows[0]);
});

export default router;
