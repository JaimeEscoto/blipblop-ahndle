import { Router, Request, Response } from 'express';
import pool from '../database';
import { requireAuth, requireClinicMember } from '../auth';
import { requireClinic } from '../tenant';

const router = Router();
router.use(requireClinic, requireAuth, requireClinicMember);

router.get('/', async (req: Request, res: Response) => {
  const { rows } = await pool.query('SELECT * FROM doctors WHERE clinic_id = $1 ORDER BY name ASC', [req.clinic!.id]);
  res.json(rows);
});

router.get('/:id', async (req: Request, res: Response) => {
  const { rows } = await pool.query('SELECT * FROM doctors WHERE id = $1 AND clinic_id = $2', [req.params.id, req.clinic!.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Médico no encontrado' });
  res.json(rows[0]);
});

router.post('/', async (req: Request, res: Response) => {
  const { name, specialty, email, phone, license_number } = req.body;
  if (!name || !specialty || !email) return res.status(400).json({ error: 'Nombre, especialidad y email son requeridos' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO doctors (name, specialty, email, phone, license_number, clinic_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [name, specialty, email, phone || null, license_number || null, req.clinic!.id]
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
    const before = await pool.query('SELECT * FROM doctors WHERE id=$1 AND clinic_id=$2', [req.params.id, req.clinic!.id]);
    req.auditBefore = before.rows[0] || null;
    const { rows } = await pool.query(
      'UPDATE doctors SET name=$1, specialty=$2, email=$3, phone=$4, license_number=$5 WHERE id=$6 AND clinic_id=$7 RETURNING *',
      [name, specialty, email, phone || null, license_number || null, req.params.id, req.clinic!.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Médico no encontrado' });
    res.json(rows[0]);
  } catch (e: any) {
    if (e.code === '23505') return res.status(409).json({ error: 'El email ya está registrado' });
    res.status(500).json({ error: 'Error al actualizar médico' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  const { rows } = await pool.query('DELETE FROM doctors WHERE id=$1 AND clinic_id=$2 RETURNING *', [req.params.id, req.clinic!.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Médico no encontrado' });
  res.json(rows[0]);
});

export default router;
