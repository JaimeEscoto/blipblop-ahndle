import { Router, Request, Response } from 'express';
import pool from '../database';
import { requireAuth, requireClinicMember } from '../auth';
import { requireClinic } from '../tenant';

const router = Router();
router.use(requireClinic, requireAuth, requireClinicMember);

// Verifica que un paciente pertenezca a la clínica antes de operar.
async function ensureUserInClinic(userId: string, clinicId: number): Promise<boolean> {
  const r = await pool.query('SELECT 1 FROM users WHERE id = $1 AND clinic_id = $2', [userId, clinicId]);
  return !!r.rows[0];
}

// --- MEDICAL INFO ---

router.get('/info/:userId', async (req: Request, res: Response) => {
  if (!(await ensureUserInClinic(req.params.userId, req.clinic!.id))) return res.status(404).json({ error: 'Paciente no encontrado' });
  const { rows } = await pool.query('SELECT * FROM medical_info WHERE user_id = $1 AND clinic_id = $2', [req.params.userId, req.clinic!.id]);
  res.json(rows[0] || null);
});

router.post('/info/:userId', async (req: Request, res: Response) => {
  if (!(await ensureUserInClinic(req.params.userId, req.clinic!.id))) return res.status(404).json({ error: 'Paciente no encontrado' });
  const { blood_type, allergies, medical_conditions, current_medications, emergency_contact, emergency_phone } = req.body;
  const before = await pool.query('SELECT * FROM medical_info WHERE user_id=$1 AND clinic_id=$2', [req.params.userId, req.clinic!.id]);
  req.auditBefore = before.rows[0] || null;
  const { rows } = await pool.query(
    `INSERT INTO medical_info (user_id, blood_type, allergies, medical_conditions, current_medications, emergency_contact, emergency_phone, clinic_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (user_id) DO UPDATE SET
       blood_type=$2, allergies=$3, medical_conditions=$4, current_medications=$5,
       emergency_contact=$6, emergency_phone=$7, updated_at=NOW()
     RETURNING *`,
    [req.params.userId, blood_type || null, allergies || null, medical_conditions || null,
     current_medications || null, emergency_contact || null, emergency_phone || null, req.clinic!.id]
  );
  res.json(rows[0]);
});

// --- CLINICAL RECORDS ---

router.get('/records/:userId', async (req: Request, res: Response) => {
  if (!(await ensureUserInClinic(req.params.userId, req.clinic!.id))) return res.status(404).json({ error: 'Paciente no encontrado' });
  const { rows } = await pool.query(
    `SELECT cr.*, d.name as doctor_name, TO_CHAR(cr.date,'YYYY-MM-DD') as date,
            inv.id AS invoice_id, inv.number AS invoice_number, inv.status AS invoice_status
     FROM clinical_records cr
     JOIN doctors d ON cr.doctor_id = d.id
     LEFT JOIN LATERAL (
       SELECT id, number, status FROM invoices
       WHERE clinic_id = cr.clinic_id
         AND appointment_id = cr.appointment_id
         AND status <> 'cancelled'
       ORDER BY created_at DESC LIMIT 1
     ) inv ON cr.appointment_id IS NOT NULL
     WHERE cr.user_id = $1 AND cr.clinic_id = $2
     ORDER BY cr.created_at DESC`,
    [req.params.userId, req.clinic!.id]
  );
  res.json(rows);
});

router.post('/records', async (req: Request, res: Response) => {
  const { user_id, doctor_id, appointment_id, date, diagnosis, treatment, observations, tooth_chart } = req.body;
  if (!user_id || !doctor_id || !date) return res.status(400).json({ error: 'Paciente, médico y fecha son requeridos' });
  if (!(await ensureUserInClinic(String(user_id), req.clinic!.id))) return res.status(404).json({ error: 'Paciente no encontrado' });
  const { rows } = await pool.query(
    `INSERT INTO clinical_records (user_id, doctor_id, appointment_id, date, diagnosis, treatment, observations, tooth_chart, clinic_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [user_id, doctor_id, appointment_id || null, date, diagnosis || null, treatment || null,
     observations || null, tooth_chart ? JSON.stringify(tooth_chart) : '{}', req.clinic!.id]
  );
  const { rows: result } = await pool.query(
    `SELECT cr.*, d.name as doctor_name, TO_CHAR(cr.date,'YYYY-MM-DD') as date
     FROM clinical_records cr JOIN doctors d ON cr.doctor_id = d.id WHERE cr.id = $1`,
    [rows[0].id]
  );
  res.status(201).json(result[0]);
});

router.put('/records/:id', async (req: Request, res: Response) => {
  const { doctor_id, date, diagnosis, treatment, observations, tooth_chart } = req.body;
  const beforeRec = await pool.query(
    `SELECT cr.*, d.name as doctor_name, TO_CHAR(cr.date,'YYYY-MM-DD') as date
     FROM clinical_records cr JOIN doctors d ON cr.doctor_id = d.id WHERE cr.id = $1 AND cr.clinic_id = $2`,
    [req.params.id, req.clinic!.id]
  );
  req.auditBefore = beforeRec.rows[0] || null;
  const { rows } = await pool.query(
    `UPDATE clinical_records SET doctor_id=$1, date=$2, diagnosis=$3, treatment=$4, observations=$5, tooth_chart=$6
     WHERE id=$7 AND clinic_id=$8 RETURNING id`,
    [doctor_id, date, diagnosis || null, treatment || null, observations || null,
     tooth_chart ? JSON.stringify(tooth_chart) : '{}', req.params.id, req.clinic!.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Registro no encontrado' });
  const { rows: result } = await pool.query(
    `SELECT cr.*, d.name as doctor_name, TO_CHAR(cr.date,'YYYY-MM-DD') as date
     FROM clinical_records cr JOIN doctors d ON cr.doctor_id = d.id WHERE cr.id = $1`,
    [rows[0].id]
  );
  res.json(result[0]);
});

router.delete('/records/:id', async (req: Request, res: Response) => {
  const { rows } = await pool.query('DELETE FROM clinical_records WHERE id=$1 AND clinic_id=$2 RETURNING *', [req.params.id, req.clinic!.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Registro no encontrado' });
  res.json(rows[0]);
});

export default router;
