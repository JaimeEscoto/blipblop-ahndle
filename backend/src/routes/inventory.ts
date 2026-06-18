import { Router, Request, Response } from 'express';
import pool from '../database';
import { requireAuth, requireClinicMember } from '../auth';
import { requireClinic } from '../tenant';

const router = Router();
router.use(requireClinic, requireAuth, requireClinicMember);

router.get('/', async (req: Request, res: Response) => {
  const { rows } = await pool.query('SELECT * FROM inventory WHERE clinic_id = $1 ORDER BY category, name ASC', [req.clinic!.id]);
  res.json(rows);
});

router.get('/low-stock', async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    'SELECT * FROM inventory WHERE clinic_id = $1 AND quantity <= min_quantity ORDER BY quantity ASC',
    [req.clinic!.id]
  );
  res.json(rows);
});

router.post('/', async (req: Request, res: Response) => {
  const { name, category, quantity, unit, min_quantity, price, supplier } = req.body;
  if (!name || !category || !unit) return res.status(400).json({ error: 'Nombre, categoría y unidad son requeridos' });
  const { rows } = await pool.query(
    `INSERT INTO inventory (name, category, quantity, unit, min_quantity, price, supplier, clinic_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [name, category, quantity ?? 0, unit, min_quantity ?? 5, price || null, supplier || null, req.clinic!.id]
  );
  res.status(201).json(rows[0]);
});

router.put('/:id', async (req: Request, res: Response) => {
  const { name, category, quantity, unit, min_quantity, price, supplier } = req.body;
  const before = await pool.query('SELECT * FROM inventory WHERE id=$1 AND clinic_id=$2', [req.params.id, req.clinic!.id]);
  req.auditBefore = before.rows[0] || null;
  const { rows } = await pool.query(
    `UPDATE inventory SET name=$1, category=$2, quantity=$3, unit=$4, min_quantity=$5, price=$6, supplier=$7
     WHERE id=$8 AND clinic_id=$9 RETURNING *`,
    [name, category, quantity ?? 0, unit, min_quantity ?? 5, price || null, supplier || null, req.params.id, req.clinic!.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(rows[0]);
});

router.patch('/:id/quantity', async (req: Request, res: Response) => {
  const { quantity } = req.body;
  const before = await pool.query('SELECT * FROM inventory WHERE id=$1 AND clinic_id=$2', [req.params.id, req.clinic!.id]);
  req.auditBefore = before.rows[0] || null;
  const { rows } = await pool.query(
    'UPDATE inventory SET quantity=$1 WHERE id=$2 AND clinic_id=$3 RETURNING *',
    [quantity, req.params.id, req.clinic!.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(rows[0]);
});

router.delete('/:id', async (req: Request, res: Response) => {
  const { rows } = await pool.query('DELETE FROM inventory WHERE id=$1 AND clinic_id=$2 RETURNING *', [req.params.id, req.clinic!.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(rows[0]);
});

export default router;
