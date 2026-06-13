import { Router, Request, Response } from 'express';
import pool from '../database';

const router = Router();

// --- MEDICAL INFO (datos generales del paciente) ---

router.get('/info/:userId', async (req: Request, res: Response) => {
  const { rows } = await pool.query('SELECT * FROM medical_info WHERE user_id = $1', [req.params.userId]);
  res.json(rows[0] || null);
});

router.post('/info/:userId', async (req: Request, res: Response) => {
  const { blood_type, allergies, medical_conditions, current_medications, emergency_contact, emergency_phone } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO medical_info (user_id, blood_type, allergies, medical_conditions, current_medications, emergency_contact, emergency_phone)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (user_id) DO UPDATE SET
       blood_type=$2, allergies=$3, medical_conditions=$4, current_medications=$5,
       emergency_contact=$6, emergency_phone=$7, updated_at=NOW()
     RETURNING *`,
    [req.params.userId, blood_type || null, allergies || null, medical_conditions || null,
     current_medications || null, emergency_contact || null, emergency_phone || null]
  );
  res.json(rows[0]);
});

// --- CLINICAL RECORDS (historial clínico) ---

router.get('/records/:userId', async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    `SELECT cr.*, d.name as doctor_name, TO_CHAR(cr.date,'YYYY-MM-DD') as date
     FROM clinical_records cr
     JOIN doctors d ON cr.doctor_id = d.id
     WHERE cr.user_id = $1
     ORDER BY cr.created_at DESC`,
    [req.params.userId]
  );
  res.json(rows);
});

router.post('/records', async (req: Request, res: Response) => {
  const { user_id, doctor_id, appointment_id, date, diagnosis, treatment, observations, tooth_chart } = req.body;
  if (!user_id || !doctor_id || !date) return res.status(400).json({ error: 'Paciente, médico y fecha son requeridos' });
  const { rows } = await pool.query(
    `INSERT INTO clinical_records (user_id, doctor_id, appointment_id, date, diagnosis, treatment, observations, tooth_chart)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [user_id, doctor_id, appointment_id || null, date, diagnosis || null, treatment || null,
     observations || null, tooth_chart ? JSON.stringify(tooth_chart) : '{}']
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
  const { rows } = await pool.query(
    `UPDATE clinical_records SET doctor_id=$1, date=$2, diagnosis=$3, treatment=$4, observations=$5, tooth_chart=$6
     WHERE id=$7 RETURNING id`,
    [doctor_id, date, diagnosis || null, treatment || null, observations || null,
     tooth_chart ? JSON.stringify(tooth_chart) : '{}', req.params.id]
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
  const { rowCount } = await pool.query('DELETE FROM clinical_records WHERE id=$1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Registro no encontrado' });
  res.json({ message: 'Registro eliminado' });
});

export default router;
