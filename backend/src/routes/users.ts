import { Router, Request, Response } from 'express';
import pool from '../database';
import { requireAuth } from '../auth';
import { requireClinic } from '../tenant';
import { requireClinicMember } from '../auth';

const router = Router();
router.use(requireClinic, requireAuth, requireClinicMember);

const SELECT_USER = `SELECT *, TO_CHAR(birth_date, 'YYYY-MM-DD') AS birth_date FROM users`;

router.get('/', async (req: Request, res: Response) => {
  const { rows } = await pool.query(`${SELECT_USER} WHERE clinic_id = $1 ORDER BY name ASC`, [req.clinic!.id]);
  res.json(rows);
});

router.get('/:id', async (req: Request, res: Response) => {
  const { rows } = await pool.query(`${SELECT_USER} WHERE id = $1 AND clinic_id = $2`, [req.params.id, req.clinic!.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(rows[0]);
});

const FIELDS = ['name', 'email', 'phone', 'document_id', 'document_type', 'birth_date', 'gender', 'address', 'city', 'department', 'occupation'];

function pick(body: any) {
  const v: Record<string, any> = {};
  for (const f of FIELDS) v[f] = body[f] === '' || body[f] === undefined ? null : body[f];
  return v;
}

router.post('/', async (req: Request, res: Response) => {
  if (!req.body.name) return res.status(400).json({ error: 'El nombre es requerido' });
  const v = pick(req.body);
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, phone, document_id, document_type, birth_date, gender, address, city, department, occupation, clinic_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [v.name, v.email, v.phone, v.document_id, v.document_type, v.birth_date, v.gender, v.address, v.city, v.department, v.occupation, req.clinic!.id]
    );
    res.status(201).json(rows[0]);
  } catch (e: any) {
    if (e.code === '23505') return res.status(409).json({ error: 'El email ya está registrado' });
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  const v = pick(req.body);
  try {
    const before = await pool.query('SELECT * FROM users WHERE id=$1 AND clinic_id=$2', [req.params.id, req.clinic!.id]);
    req.auditBefore = before.rows[0] || null;
    const { rows } = await pool.query(
      `UPDATE users SET name=$1, email=$2, phone=$3, document_id=$4, document_type=$5, birth_date=$6,
         gender=$7, address=$8, city=$9, department=$10, occupation=$11
       WHERE id=$12 AND clinic_id=$13 RETURNING *`,
      [v.name, v.email, v.phone, v.document_id, v.document_type, v.birth_date, v.gender, v.address, v.city, v.department, v.occupation, req.params.id, req.clinic!.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(rows[0]);
  } catch (e: any) {
    if (e.code === '23505') return res.status(409).json({ error: 'El email ya está registrado' });
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  const { rows } = await pool.query('DELETE FROM users WHERE id=$1 AND clinic_id=$2 RETURNING *', [req.params.id, req.clinic!.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(rows[0]);
});

export default router;
