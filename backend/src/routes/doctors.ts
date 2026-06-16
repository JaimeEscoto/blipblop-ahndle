import { Router, Request, Response } from 'express';
import pool from '../database';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const { rows } = await pool.query('SELECT * FROM doctors ORDER BY name ASC');
  res.json(rows);
});

router.get('/:id', async (req: Request, res: Response) => {
  const { rows } = await pool.query('SELECT * FROM doctors WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Médico no encontrado' });
  res.json(rows[0]);
});

router.post('/', async (req: Request, res: Response) => {
  const { name, specialty, email, phone, license_number } = req.body;
  if (!name || !specialty || !email) return res.status(400).json({ error: 'Nombre, especialidad y email son requeridos' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO doctors (name, specialty, email, phone, license_number) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [name, specialty, email, phone || null, license_number || null]
    );
    res.status(201).json(rows[0]);
  } catch (e: any) {
    if (e.code === '23505') return res.status(409).json({ error: 'El email ya está registrado' });
    res.status(500).json({ error: 'Error al crear médico' });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  const { name, specialty, email, phone, license_number } = req.body;
  try {
    const before = await pool.query('SELECT * FROM doctors WHERE id=$1', [req.params.id]);
    req.auditBefore = before.rows[0] || null;
    const { rows } = await pool.query(
      'UPDATE doctors SET name=$1, specialty=$2, email=$3, phone=$4, license_number=$5 WHERE id=$6 RETURNING *',
      [name, specialty, email, phone || null, license_number || null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Médico no encontrado' });
    res.json(rows[0]);
  } catch (e: any) {
    if (e.code === '23505') return res.status(409).json({ error: 'El email ya está registrado' });
    res.status(500).json({ error: 'Error al actualizar médico' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  const { rows } = await pool.query('DELETE FROM doctors WHERE id=$1 RETURNING *', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Médico no encontrado' });
  res.json(rows[0]);
});

export default router;
