import { Router, Request, Response } from 'express';
import pool from '../database';
import { requireAuth, requireClinicMember } from '../auth';
import { requireClinic } from '../tenant';
import { generateAppointmentCode } from '../utils/code';

const router = Router();
router.use(requireClinic, requireAuth, requireClinicMember);

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

// SELECT base con datos relacionados + progreso (X de N).
const SELECT_PLAN = `
  SELECT tp.id, tp.clinic_id, tp.user_id, tp.doctor_id, tp.procedure_id,
    tp.total_amount, tp.sessions_planned, tp.per_session_amount,
    tp.status, tp.notes, tp.created_at,
    u.name AS user_name,
    d.name AS doctor_name, d.specialty AS doctor_specialty,
    p.name AS procedure_name, p.code AS procedure_code,
    (SELECT COUNT(*) FROM appointments WHERE treatment_plan_id = tp.id AND status = 'completed')::int AS sessions_completed,
    (SELECT COUNT(*) FROM appointments WHERE treatment_plan_id = tp.id AND status = 'scheduled')::int AS sessions_scheduled,
    (SELECT COUNT(*) FROM appointments WHERE treatment_plan_id = tp.id AND status = 'cancelled')::int AS sessions_cancelled
  FROM treatment_plans tp
  JOIN users u ON u.id = tp.user_id
  JOIN doctors d ON d.id = tp.doctor_id
  JOIN procedures p ON p.id = tp.procedure_id
`;

// Carga las citas del plan en orden de sesión.
async function loadPlanAppointments(planId: number) {
  const { rows } = await pool.query(
    `SELECT a.id, a.session_number, a.status, a.public_code,
       TO_CHAR(a.date, 'YYYY-MM-DD') AS date,
       TO_CHAR(a.time, 'HH24:MI') AS time
     FROM appointments a
     WHERE a.treatment_plan_id = $1
     ORDER BY a.session_number ASC`,
    [planId]
  );
  return rows;
}

// ── GET /api/treatments?user_id=... ────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  const conds = ['tp.clinic_id = $1'];
  const params: any[] = [req.clinic!.id];
  if (req.query.user_id) { params.push(req.query.user_id); conds.push(`tp.user_id = $${params.length}`); }
  if (req.query.status)  { params.push(req.query.status);  conds.push(`tp.status = $${params.length}`); }
  const { rows } = await pool.query(
    `${SELECT_PLAN} WHERE ${conds.join(' AND ')} ORDER BY tp.created_at DESC`,
    params
  );
  res.json(rows);
});

// ── GET /api/treatments/:id ────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    `${SELECT_PLAN} WHERE tp.id = $1 AND tp.clinic_id = $2`,
    [req.params.id, req.clinic!.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Plan no encontrado' });
  const appointments = await loadPlanAppointments(rows[0].id);
  res.json({ ...rows[0], appointments });
});

// ── POST /api/treatments ───────────────────────────────────────────────
// Crea el plan y N citas propuestas, espaciadas por interval_weeks a partir
// de start_date a la hora "time".
router.post('/', async (req: Request, res: Response) => {
  const {
    user_id, doctor_id, procedure_id,
    total_amount, sessions_planned,
    start_date, time, interval_weeks,
    notes,
  } = req.body;

  if (!user_id || !doctor_id || !procedure_id) {
    return res.status(400).json({ error: 'Paciente, doctor y procedimiento son requeridos' });
  }
  const sessions = Math.max(1, Number(sessions_planned) || 1);
  const total = Math.max(0, Number(total_amount) || 0);
  const interval = Math.max(0, Number(interval_weeks) || 0);
  if (!start_date || !time) {
    return res.status(400).json({ error: 'Fecha y hora inicial son requeridas' });
  }

  // Validar pertenencia a la clínica
  const proc = await pool.query('SELECT id, name FROM procedures WHERE id = $1 AND clinic_id = $2',
    [procedure_id, req.clinic!.id]);
  if (!proc.rows[0]) return res.status(404).json({ error: 'Procedimiento no pertenece a esta clínica' });
  const u = await pool.query('SELECT 1 FROM users WHERE id = $1 AND clinic_id = $2', [user_id, req.clinic!.id]);
  if (!u.rows[0]) return res.status(404).json({ error: 'Paciente no encontrado' });
  const dRes = await pool.query('SELECT 1 FROM doctors WHERE id = $1 AND clinic_id = $2', [doctor_id, req.clinic!.id]);
  if (!dRes.rows[0]) return res.status(404).json({ error: 'Doctor no encontrado' });

  const perSession = round2(sessions > 0 ? total / sessions : 0);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const planRow = await client.query(
      `INSERT INTO treatment_plans
         (clinic_id, user_id, doctor_id, procedure_id, total_amount, sessions_planned, per_session_amount, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8)
       RETURNING id`,
      [req.clinic!.id, user_id, doctor_id, procedure_id, total, sessions, perSession, notes || null]
    );
    const planId = planRow.rows[0].id;

    // Generar N citas: fecha = start_date + (i-1) * interval_weeks * 7 días
    for (let i = 1; i <= sessions; i++) {
      await client.query(
        `INSERT INTO appointments
           (clinic_id, user_id, doctor_id, date, time, reason, status, public_code, treatment_plan_id, session_number)
         VALUES ($1, $2, $3, ($4::date + ($5 * INTERVAL '7 days')), $6, $7, 'scheduled', $8, $9, $10)`,
        [req.clinic!.id, user_id, doctor_id,
         start_date, (i - 1) * interval, time,
         `Sesión ${i} de ${sessions} — ${proc.rows[0].name}`,
         generateAppointmentCode(), planId, i]
      );
    }

    await client.query('COMMIT');
    const r = await pool.query(`${SELECT_PLAN} WHERE tp.id = $1`, [planId]);
    const appts = await loadPlanAppointments(planId);
    res.status(201).json({ ...r.rows[0], appointments: appts });
  } catch (e: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message || 'No se pudo crear el plan' });
  } finally {
    client.release();
  }
});

// ── PUT /api/treatments/:id ────────────────────────────────────────────
// Actualiza total, sesiones y notas. El recálculo SOLO afecta a sesiones
// futuras (no completadas): per_session_amount nuevo aplica al generar la
// factura draft. Las facturas ya creadas no se tocan.
// Si sessions_planned aumenta, se generan citas extra al final.
// Si disminuye, se eliminan citas FUTURAS sobrantes (las pasadas no se tocan).
router.put('/:id', async (req: Request, res: Response) => {
  const { total_amount, sessions_planned, notes } = req.body;
  const total = Math.max(0, Number(total_amount) || 0);
  const sessions = Math.max(1, Number(sessions_planned) || 1);

  const current = await pool.query(
    `${SELECT_PLAN} WHERE tp.id = $1 AND tp.clinic_id = $2`,
    [req.params.id, req.clinic!.id]
  );
  if (!current.rows[0]) return res.status(404).json({ error: 'Plan no encontrado' });

  const completedRes = await pool.query(
    `SELECT COUNT(*)::int AS n FROM appointments
     WHERE treatment_plan_id = $1 AND status = 'completed'`,
    [req.params.id]
  );
  const completedN: number = completedRes.rows[0].n;
  if (sessions < completedN) {
    return res.status(400).json({ error: `Ya hay ${completedN} sesiones completadas; no puedes bajar a menos.` });
  }

  const perSession = round2(sessions > 0 ? total / sessions : 0);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE treatment_plans SET total_amount=$1, sessions_planned=$2,
         per_session_amount=$3, notes=$4
       WHERE id=$5 AND clinic_id=$6`,
      [total, sessions, perSession, notes ?? null, req.params.id, req.clinic!.id]
    );

    const currentSessions = current.rows[0].sessions_planned;
    if (sessions > currentSessions) {
      // Agregar nuevas citas al final, tomando como base la última cita planificada
      const last = await client.query(
        `SELECT a.date, a.time, a.session_number,
           u.id AS user_id, d.id AS doctor_id, p.id AS procedure_id, p.name AS procedure_name
         FROM appointments a
         JOIN treatment_plans tp ON tp.id = a.treatment_plan_id
         JOIN users u ON u.id = tp.user_id
         JOIN doctors d ON d.id = tp.doctor_id
         JOIN procedures p ON p.id = tp.procedure_id
         WHERE a.treatment_plan_id = $1
         ORDER BY a.session_number DESC LIMIT 1`,
        [req.params.id]
      );
      const baseDate = last.rows[0]?.date;
      const baseTime = last.rows[0]?.time;
      const intervalDays = 28; // default 4 semanas si no se pasa
      for (let n = currentSessions + 1; n <= sessions; n++) {
        const offset = (n - currentSessions) * intervalDays;
        await client.query(
          `INSERT INTO appointments
             (clinic_id, user_id, doctor_id, date, time, reason, status, public_code, treatment_plan_id, session_number)
           VALUES ($1, $2, $3, ($4::date + ($5 || ' days')::interval), $6,
                   $7, 'scheduled', $8, $9, $10)`,
          [req.clinic!.id, last.rows[0].user_id, last.rows[0].doctor_id,
           baseDate, offset, baseTime,
           `Sesión ${n} de ${sessions} — ${last.rows[0].procedure_name}`,
           generateAppointmentCode(), req.params.id, n]
        );
      }
    } else if (sessions < currentSessions) {
      // Eliminar citas futuras sobrantes (solo las que NO estén completadas)
      await client.query(
        `DELETE FROM appointments
         WHERE treatment_plan_id = $1
           AND session_number > $2
           AND status <> 'completed'`,
        [req.params.id, sessions]
      );
    }

    // Re-numerar la descripción de las citas futuras para reflejar "Sesión X de N"
    await client.query(
      `UPDATE appointments a
       SET reason = 'Sesión ' || a.session_number || ' de ' || $1 || ' — ' || p.name
       FROM treatment_plans tp
       JOIN procedures p ON p.id = tp.procedure_id
       WHERE a.treatment_plan_id = tp.id
         AND tp.id = $2
         AND a.status <> 'completed'`,
      [sessions, req.params.id]
    );

    await client.query('COMMIT');
    const r = await pool.query(`${SELECT_PLAN} WHERE tp.id = $1`, [req.params.id]);
    const appts = await loadPlanAppointments(Number(req.params.id));
    res.json({ ...r.rows[0], appointments: appts });
  } catch (e: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message || 'No se pudo actualizar el plan' });
  } finally {
    client.release();
  }
});

// ── PATCH /api/treatments/:id/sessions/:sessionNumber/reschedule ───────
// Mueve la sesión a una nueva fecha/hora. Si cascade_following=true,
// desplaza todas las sesiones siguientes (no completadas) el mismo número
// de días que esta.
router.patch('/:id/sessions/:sessionNumber/reschedule', async (req: Request, res: Response) => {
  const { date, time, cascade_following } = req.body;
  if (!date || !time) return res.status(400).json({ error: 'Fecha y hora son requeridas' });

  const target = await pool.query(
    `SELECT a.id, a.date::text AS date, a.session_number, a.status
     FROM appointments a
     JOIN treatment_plans tp ON tp.id = a.treatment_plan_id
     WHERE tp.id = $1 AND tp.clinic_id = $2 AND a.session_number = $3`,
    [req.params.id, req.clinic!.id, req.params.sessionNumber]
  );
  if (!target.rows[0]) return res.status(404).json({ error: 'Sesión no encontrada' });
  if (target.rows[0].status === 'completed') {
    return res.status(400).json({ error: 'No se puede reprogramar una sesión ya completada' });
  }

  const oldDate = target.rows[0].date;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE appointments SET date = $1, time = $2 WHERE id = $3`,
      [date, time, target.rows[0].id]
    );
    if (cascade_following) {
      await client.query(
        `UPDATE appointments
         SET date = date + ($1::date - $2::date)
         WHERE treatment_plan_id = $3
           AND session_number > $4
           AND status <> 'completed'`,
        [date, oldDate, req.params.id, target.rows[0].session_number]
      );
    }
    await client.query('COMMIT');

    const r = await pool.query(`${SELECT_PLAN} WHERE tp.id = $1`, [req.params.id]);
    const appts = await loadPlanAppointments(Number(req.params.id));
    res.json({ ...r.rows[0], appointments: appts });
  } catch (e: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message || 'No se pudo reprogramar' });
  } finally {
    client.release();
  }
});

// ── PATCH /api/treatments/:id/status ───────────────────────────────────
router.patch('/:id/status', async (req: Request, res: Response) => {
  const { status } = req.body;
  if (!['active', 'completed', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }
  const { rows } = await pool.query(
    `UPDATE treatment_plans SET status=$1 WHERE id=$2 AND clinic_id=$3 RETURNING id`,
    [status, req.params.id, req.clinic!.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Plan no encontrado' });
  res.json({ id: rows[0].id, status });
});

export default router;
