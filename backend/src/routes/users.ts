import { Router, Request, Response } from 'express';
import pool from '../database';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const { rows } = await pool.query('SELECT * FROM users ORDER BY name ASC');
  res.json(rows);
});

router.get('/:id', async (req: Request, res: Response) => {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(rows[0]);
});

router.post('/', async (req: Request, res: Response) => {
  const { name, email, phone, document_id } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Nombre y email son requeridos' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO users (name, email, phone, document_id) VALUES ($1,$2,$3,$4) RETURNING *',
      [name, email, phone || null, document_id || null]
    );
    res.status(201).json(rows[0]);
  } catch (e: any) {
    if (e.code === '23505') return res.status(409).json({ error: 'El email ya está registrado' });
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  const { name, email, phone, document_id } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE users SET name=$1, email=$2, phone=$3, document_id=$4 WHERE id=$5 RETURNING *',
      [name, email, phone || null, document_id || null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(rows[0]);
  } catch (e: any) {
    if (e.code === '23505') return res.status(409).json({ error: 'El email ya está registrado' });
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  const { rowCount } = await pool.query('DELETE FROM users WHERE id=$1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json({ message: 'Usuario eliminado' });
});

export default router;
