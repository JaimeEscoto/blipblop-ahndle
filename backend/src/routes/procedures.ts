import { Router, Request, Response } from 'express';
import pool from '../database';
import { requireAuth, requireClinicMember } from '../auth';
import { requireClinic } from '../tenant';

const router = Router();
router.use(requireClinic, requireAuth, requireClinicMember);

router.get('/', async (req: Request, res: Response) => {
  const includeInactive = req.query.all === '1';
  const where = includeInactive ? 'clinic_id = $1' : 'clinic_id = $1 AND active = true';
  const { rows } = await pool.query(
    `SELECT * FROM procedures WHERE ${where} ORDER BY name ASC`,
    [req.clinic!.id]
  );
  res.json(rows);
});

router.post('/', async (req: Request, res: Response) => {
  const { name, code, description, default_price, duration_minutes } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
  const { rows } = await pool.query(
    `INSERT INTO procedures (clinic_id, name, code, description, default_price, duration_minutes)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [req.clinic!.id, name.trim(), code || null, description || null,
     Number(default_price) || 0, duration_minutes ? Number(duration_minutes) : null]
  );
  res.status(201).json(rows[0]);
});

router.put('/:id', async (req: Request, res: Response) => {
  const { name, code, description, default_price, duration_minutes, active } = req.body;
  const before = await pool.query('SELECT * FROM procedures WHERE id=$1 AND clinic_id=$2', [req.params.id, req.clinic!.id]);
  req.auditBefore = before.rows[0] || null;
  const { rows } = await pool.query(
    `UPDATE procedures SET name=$1, code=$2, description=$3, default_price=$4, duration_minutes=$5,
       active=COALESCE($6, active)
     WHERE id=$7 AND clinic_id=$8 RETURNING *`,
    [name?.trim() || null, code || null, description || null,
     Number(default_price) || 0, duration_minutes ? Number(duration_minutes) : null,
     active === undefined ? null : !!active,
     req.params.id, req.clinic!.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Procedimiento no encontrado' });
  res.json(rows[0]);
});

router.delete('/:id', async (req: Request, res: Response) => {
  // Soft delete: marca inactivo si tiene uso en items, sino borra
  const inUse = await pool.query(
    'SELECT 1 FROM invoice_items WHERE procedure_id = $1 LIMIT 1',
    [req.params.id]
  );
  if (inUse.rows[0]) {
    const { rows } = await pool.query(
      'UPDATE procedures SET active=false WHERE id=$1 AND clinic_id=$2 RETURNING *',
      [req.params.id, req.clinic!.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Procedimiento no encontrado' });
    return res.json({ ...rows[0], _softDeleted: true });
  }
  const { rows } = await pool.query(
    'DELETE FROM procedures WHERE id=$1 AND clinic_id=$2 RETURNING *',
    [req.params.id, req.clinic!.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Procedimiento no encontrado' });
  res.json(rows[0]);
});

export default router;
