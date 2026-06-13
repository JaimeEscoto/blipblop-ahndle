import { Router, Request, Response } from 'express';
import pool from '../database';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const { rows } = await pool.query(
    `SELECT r.*, u.name as user_name, u.phone as user_phone,
       TO_CHAR(r.date,'YYYY-MM-DD') as date,
       TO_CHAR(r.time,'HH24:MI') as time
     FROM reminders r
     LEFT JOIN users u ON r.user_id = u.id
     ORDER BY r.date ASC, r.time ASC`
  );
  res.json(rows);
});

router.post('/', async (req: Request, res: Response) => {
  const { title, description, date, time, type, user_id } = req.body;
  if (!title || !date) return res.status(400).json({ error: 'Título y fecha son requeridos' });
  const { rows } = await pool.query(
    `INSERT INTO reminders (title, description, date, time, type, user_id)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [title, description || null, date, time || null, type || 'task', user_id || null]
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
  const { rows } = await pool.query(
    'UPDATE reminders SET status=$1 WHERE id=$2 RETURNING id', [status, req.params.id]
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
  const { rowCount } = await pool.query('DELETE FROM reminders WHERE id=$1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Recordatorio no encontrado' });
  res.json({ message: 'Recordatorio eliminado' });
});

export default router;
