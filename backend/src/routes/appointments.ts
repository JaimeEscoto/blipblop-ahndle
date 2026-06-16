import { Router, Request, Response } from 'express';
import pool from '../database';
import { generateAppointmentCode } from '../utils/code';
import { requireAuth } from '../auth';

const router = Router();

// Fecha "hoy" en la zona horaria de la clínica (independiente del TZ del servidor)
function clinicToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
}
function isPastDate(date: string): boolean {
  return date < clinicToday();
}

// SELECT reducido para la vista pública (sin email/teléfono del paciente)
const SELECT_PUBLIC = `
  SELECT a.id, a.public_code, a.reason, a.status,
    TO_CHAR(a.date, 'YYYY-MM-DD') AS date,
    TO_CHAR(a.time, 'HH24:MI') AS time,
    u.name AS user_name,
    d.name AS doctor_name, d.specialty AS doctor_specialty
  FROM appointments a
  JOIN users u ON a.user_id = u.id
  JOIN doctors d ON a.doctor_id = d.id
`;

const SELECT_WITH_RELATIONS = `
  SELECT a.*,
    TO_CHAR(a.date, 'YYYY-MM-DD') AS date,
    TO_CHAR(a.time, 'HH24:MI') AS time,
    u.name AS user_name, u.email AS user_email, u.phone AS user_phone,
    d.name AS doctor_name, d.specialty AS doctor_specialty
  FROM appointments a
  JOIN users u ON a.user_id = u.id
  JOIN doctors d ON a.doctor_id = d.id
`;

// Endpoint público: el paciente accede al escanear el QR (sin autenticación).
// Se declara ANTES del guard para que no requiera sesión.
router.get('/public/:code', async (req: Request, res: Response) => {
  const { rows } = await pool.query(`${SELECT_PUBLIC} WHERE a.public_code = $1`, [req.params.code]);
  if (!rows[0]) return res.status(404).json({ error: 'Cita no encontrada' });
  res.json(rows[0]);
});

// A partir de aquí, todo requiere sesión válida
router.use(requireAuth);

router.get('/', async (_req: Request, res: Response) => {
  const { rows } = await pool.query(`${SELECT_WITH_RELATIONS} ORDER BY a.date DESC, a.time DESC`);
  res.json(rows);
});

router.get('/:id', async (req: Request, res: Response) => {
  const { rows } = await pool.query(`${SELECT_WITH_RELATIONS} WHERE a.id = $1`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Cita no encontrada' });
  res.json(rows[0]);
});

router.post('/', async (req: Request, res: Response) => {
  const { user_id, doctor_id, date, time, reason, notes } = req.body;
  if (!user_id || !doctor_id || !date || !time) {
    return res.status(400).json({ error: 'Paciente, médico, fecha y hora son requeridos' });
  }
  if (isPastDate(date)) {
    return res.status(400).json({ error: 'No se pueden agendar citas en una fecha pasada' });
  }
  const conflict = await pool.query(
    `SELECT id FROM appointments WHERE doctor_id=$1 AND date=$2 AND time=$3 AND status != 'cancelled'`,
    [doctor_id, date, time]
  );
  if (conflict.rows[0]) return res.status(409).json({ error: 'El médico ya tiene una cita en ese horario' });

  const { rows } = await pool.query(
    'INSERT INTO appointments (user_id, doctor_id, date, time, reason, notes, public_code) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
    [user_id, doctor_id, date, time, reason || null, notes || null, generateAppointmentCode()]
  );
  const { rows: result } = await pool.query(`${SELECT_WITH_RELATIONS} WHERE a.id = $1`, [rows[0].id]);
  res.status(201).json(result[0]);
});

router.put('/:id', async (req: Request, res: Response) => {
  const { user_id, doctor_id, date, time, reason, status, notes } = req.body;
  // Solo bloquea reprogramar a una fecha pasada; permite editar otros campos de citas viejas
  const current = await pool.query('SELECT TO_CHAR(date, $2) AS date FROM appointments WHERE id=$1', [req.params.id, 'YYYY-MM-DD']);
  if (current.rows[0] && date !== current.rows[0].date && isPastDate(date)) {
    return res.status(400).json({ error: 'No se pueden reprogramar citas a una fecha pasada' });
  }
  const conflict = await pool.query(
    `SELECT id FROM appointments WHERE doctor_id=$1 AND date=$2 AND time=$3 AND status != 'cancelled' AND id != $4`,
    [doctor_id, date, time, req.params.id]
  );
  if (conflict.rows[0]) return res.status(409).json({ error: 'El médico ya tiene una cita en ese horario' });

  const before = await pool.query(`${SELECT_WITH_RELATIONS} WHERE a.id = $1`, [req.params.id]);
  req.auditBefore = before.rows[0] || null;
  const { rows } = await pool.query(
    `UPDATE appointments SET user_id=$1, doctor_id=$2, date=$3, time=$4, reason=$5, status=$6, notes=$7
     WHERE id=$8 RETURNING id`,
    [user_id, doctor_id, date, time, reason || null, status || 'scheduled', notes || null, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Cita no encontrada' });
  const { rows: result } = await pool.query(`${SELECT_WITH_RELATIONS} WHERE a.id = $1`, [rows[0].id]);
  res.json(result[0]);
});

router.patch('/:id/status', async (req: Request, res: Response) => {
  const { status } = req.body;
  if (!['scheduled', 'completed', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }
  const before = await pool.query(`${SELECT_WITH_RELATIONS} WHERE a.id = $1`, [req.params.id]);
  req.auditBefore = before.rows[0] || null;
  const { rows } = await pool.query(
    'UPDATE appointments SET status=$1 WHERE id=$2 RETURNING id',
    [status, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Cita no encontrada' });
  const { rows: result } = await pool.query(`${SELECT_WITH_RELATIONS} WHERE a.id = $1`, [rows[0].id]);
  res.json(result[0]);
});

router.delete('/:id', async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    `WITH deleted AS (DELETE FROM appointments WHERE id=$1 RETURNING *)
     SELECT deleted.*,
       TO_CHAR(deleted.date, 'YYYY-MM-DD') AS date,
       TO_CHAR(deleted.time, 'HH24:MI') AS time,
       u.name AS user_name, d.name AS doctor_name, d.specialty AS doctor_specialty
     FROM deleted
     JOIN users u ON deleted.user_id = u.id
     JOIN doctors d ON deleted.doctor_id = d.id`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Cita no encontrada' });
  res.json(rows[0]);
});

export default router;
