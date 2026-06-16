import { Router, Request, Response } from 'express';
import pool from '../database';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const { rows } = await pool.query('SELECT * FROM inventory ORDER BY category, name ASC');
  res.json(rows);
});

router.get('/low-stock', async (_req: Request, res: Response) => {
  const { rows } = await pool.query('SELECT * FROM inventory WHERE quantity <= min_quantity ORDER BY quantity ASC');
  res.json(rows);
});

router.post('/', async (req: Request, res: Response) => {
  const { name, category, quantity, unit, min_quantity, price, supplier } = req.body;
  if (!name || !category || !unit) return res.status(400).json({ error: 'Nombre, categoría y unidad son requeridos' });
  const { rows } = await pool.query(
    `INSERT INTO inventory (name, category, quantity, unit, min_quantity, price, supplier)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [name, category, quantity ?? 0, unit, min_quantity ?? 5, price || null, supplier || null]
  );
  res.status(201).json(rows[0]);
});

router.put('/:id', async (req: Request, res: Response) => {
  const { name, category, quantity, unit, min_quantity, price, supplier } = req.body;
  const before = await pool.query('SELECT * FROM inventory WHERE id=$1', [req.params.id]);
  req.auditBefore = before.rows[0] || null;
  const { rows } = await pool.query(
    `UPDATE inventory SET name=$1, category=$2, quantity=$3, unit=$4, min_quantity=$5, price=$6, supplier=$7
     WHERE id=$8 RETURNING *`,
    [name, category, quantity ?? 0, unit, min_quantity ?? 5, price || null, supplier || null, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(rows[0]);
});

router.patch('/:id/quantity', async (req: Request, res: Response) => {
  const { quantity } = req.body;
  const before = await pool.query('SELECT * FROM inventory WHERE id=$1', [req.params.id]);
  req.auditBefore = before.rows[0] || null;
  const { rows } = await pool.query(
    'UPDATE inventory SET quantity=$1 WHERE id=$2 RETURNING *',
    [quantity, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(rows[0]);
});

router.delete('/:id', async (req: Request, res: Response) => {
  const { rows } = await pool.query('DELETE FROM inventory WHERE id=$1 RETURNING *', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(rows[0]);
});

export default router;
