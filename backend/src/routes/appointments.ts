import { Router, Request, Response } from 'express';
import pool from '../database';
import { generateAppointmentCode } from '../utils/code';
import { requireAuth, requireClinicMember } from '../auth';
import { requireClinic } from '../tenant';

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

// Procedimientos planificados de una cita, con nombre y precio del catálogo.
async function loadAppointmentProcedures(appointmentId: number) {
  const { rows } = await pool.query(
    `SELECT ap.id, ap.procedure_id, ap.quantity, ap.unit_price, ap.position,
       p.code AS procedure_code, p.name AS procedure_name, p.default_price
     FROM appointment_procedures ap
     JOIN procedures p ON p.id = ap.procedure_id
     WHERE ap.appointment_id = $1
     ORDER BY ap.position ASC, ap.id ASC`,
    [appointmentId]
  );
  return rows;
}

// Reemplaza el set de procedimientos de una cita dentro de la transacción.
// Valida que cada procedimiento pertenezca a la misma clínica.
async function replaceAppointmentProcedures(
  client: any,
  appointmentId: number,
  clinicId: number,
  procedures: Array<{ procedure_id: number; quantity?: number; unit_price?: number | null }>
) {
  await client.query('DELETE FROM appointment_procedures WHERE appointment_id = $1', [appointmentId]);
  if (!procedures || procedures.length === 0) return;
  const ids = procedures.map(p => Number(p.procedure_id)).filter(n => Number.isFinite(n));
  if (ids.length !== procedures.length) {
    throw new Error('Procedimiento inválido');
  }
  const check = await client.query(
    `SELECT id, default_price FROM procedures WHERE id = ANY($1::int[]) AND clinic_id = $2`,
    [ids, clinicId]
  );
  if (check.rows.length !== new Set(ids).size) {
    throw new Error('Algún procedimiento no pertenece a la clínica');
  }
  const defaultPriceById = new Map<number, number>(
    check.rows.map((r: any) => [Number(r.id), Number(r.default_price) || 0])
  );
  for (let i = 0; i < procedures.length; i++) {
    const p = procedures[i];
    const qty = Number(p.quantity) > 0 ? Number(p.quantity) : 1;
    const price = p.unit_price !== undefined && p.unit_price !== null
      ? Number(p.unit_price)
      : (defaultPriceById.get(Number(p.procedure_id)) ?? 0);
    await client.query(
      `INSERT INTO appointment_procedures (appointment_id, procedure_id, quantity, unit_price, position)
       VALUES ($1, $2, $3, $4, $5)`,
      [appointmentId, p.procedure_id, qty, price, i]
    );
  }
}

// Endpoint público (QR del paciente): SIN autenticación, busca por código global.
// El código es único en todo el sistema (UNIQUE INDEX) así que no necesita clínica.
router.get('/public/:code', async (req: Request, res: Response) => {
  const { rows } = await pool.query(`${SELECT_PUBLIC} WHERE a.public_code = $1`, [req.params.code]);
  if (!rows[0]) return res.status(404).json({ error: 'Cita no encontrada' });
  res.json(rows[0]);
});

// A partir de aquí, todo requiere clínica + sesión válida en esa clínica
router.use(requireClinic, requireAuth, requireClinicMember);

router.get('/', async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    `${SELECT_WITH_RELATIONS} WHERE a.clinic_id = $1 ORDER BY a.date DESC, a.time DESC`,
    [req.clinic!.id]
  );
  // Cargar procedimientos planificados de todas las citas de un golpe
  const ids = rows.map(r => r.id);
  if (ids.length === 0) return res.json(rows);
  const { rows: procs } = await pool.query(
    `SELECT ap.appointment_id, ap.id, ap.procedure_id, ap.quantity, ap.unit_price, ap.position,
       p.code AS procedure_code, p.name AS procedure_name, p.default_price
     FROM appointment_procedures ap
     JOIN procedures p ON p.id = ap.procedure_id
     WHERE ap.appointment_id = ANY($1::int[])
     ORDER BY ap.position ASC, ap.id ASC`,
    [ids]
  );
  const byAppt = new Map<number, any[]>();
  for (const p of procs) {
    const arr = byAppt.get(p.appointment_id) || [];
    arr.push(p);
    byAppt.set(p.appointment_id, arr);
  }
  res.json(rows.map(r => ({ ...r, procedures: byAppt.get(r.id) || [] })));
});

router.get('/:id', async (req: Request, res: Response) => {
  const { rows } = await pool.query(`${SELECT_WITH_RELATIONS} WHERE a.id = $1 AND a.clinic_id = $2`, [req.params.id, req.clinic!.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Cita no encontrada' });
  const procedures = await loadAppointmentProcedures(rows[0].id);
  res.json({ ...rows[0], procedures });
});

router.post('/', async (req: Request, res: Response) => {
  const { user_id, doctor_id, date, time, reason, notes, procedures } = req.body;
  if (!user_id || !doctor_id || !date || !time) {
    return res.status(400).json({ error: 'Paciente, médico, fecha y hora son requeridos' });
  }
  if (isPastDate(date)) {
    return res.status(400).json({ error: 'No se pueden agendar citas en una fecha pasada' });
  }
  const conflict = await pool.query(
    `SELECT id FROM appointments WHERE doctor_id=$1 AND date=$2 AND time=$3 AND status != 'cancelled' AND clinic_id=$4`,
    [doctor_id, date, time, req.clinic!.id]
  );
  if (conflict.rows[0]) return res.status(409).json({ error: 'El médico ya tiene una cita en ese horario' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'INSERT INTO appointments (user_id, doctor_id, date, time, reason, notes, public_code, clinic_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
      [user_id, doctor_id, date, time, reason || null, notes || null, generateAppointmentCode(), req.clinic!.id]
    );
    await replaceAppointmentProcedures(client, rows[0].id, req.clinic!.id, Array.isArray(procedures) ? procedures : []);
    await client.query('COMMIT');
    const { rows: result } = await pool.query(`${SELECT_WITH_RELATIONS} WHERE a.id = $1`, [rows[0].id]);
    const procs = await loadAppointmentProcedures(rows[0].id);
    res.status(201).json({ ...result[0], procedures: procs });
  } catch (e: any) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message || 'No se pudo crear la cita' });
  } finally {
    client.release();
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  const { user_id, doctor_id, date, time, reason, status, notes, procedures } = req.body;
  const current = await pool.query('SELECT TO_CHAR(date, $2) AS date FROM appointments WHERE id=$1 AND clinic_id=$3',
    [req.params.id, 'YYYY-MM-DD', req.clinic!.id]);
  if (current.rows[0] && date !== current.rows[0].date && isPastDate(date)) {
    return res.status(400).json({ error: 'No se pueden reprogramar citas a una fecha pasada' });
  }
  const conflict = await pool.query(
    `SELECT id FROM appointments WHERE doctor_id=$1 AND date=$2 AND time=$3 AND status != 'cancelled' AND id != $4 AND clinic_id=$5`,
    [doctor_id, date, time, req.params.id, req.clinic!.id]
  );
  if (conflict.rows[0]) return res.status(409).json({ error: 'El médico ya tiene una cita en ese horario' });

  const before = await pool.query(`${SELECT_WITH_RELATIONS} WHERE a.id = $1 AND a.clinic_id = $2`, [req.params.id, req.clinic!.id]);
  req.auditBefore = before.rows[0] || null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE appointments SET user_id=$1, doctor_id=$2, date=$3, time=$4, reason=$5, status=$6, notes=$7
       WHERE id=$8 AND clinic_id=$9 RETURNING id`,
      [user_id, doctor_id, date, time, reason || null, status || 'scheduled', notes || null, req.params.id, req.clinic!.id]
    );
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Cita no encontrada' });
    }
    // Solo reemplazar procedimientos si vienen en el body (omitir = no tocar)
    if (Array.isArray(procedures)) {
      await replaceAppointmentProcedures(client, rows[0].id, req.clinic!.id, procedures);
    }
    await client.query('COMMIT');
    const { rows: result } = await pool.query(`${SELECT_WITH_RELATIONS} WHERE a.id = $1`, [rows[0].id]);
    const procs = await loadAppointmentProcedures(rows[0].id);
    res.json({ ...result[0], procedures: procs });
  } catch (e: any) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message || 'No se pudo actualizar la cita' });
  } finally {
    client.release();
  }
});

router.patch('/:id/status', async (req: Request, res: Response) => {
  const { status } = req.body;
  if (!['scheduled', 'completed', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }
  const before = await pool.query(`${SELECT_WITH_RELATIONS} WHERE a.id = $1 AND a.clinic_id = $2`, [req.params.id, req.clinic!.id]);
  req.auditBefore = before.rows[0] || null;

  const client = await pool.connect();
  let draftInvoiceId: number | null = null;
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'UPDATE appointments SET status=$1 WHERE id=$2 AND clinic_id=$3 RETURNING id, user_id, doctor_id',
      [status, req.params.id, req.clinic!.id]
    );
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Cita no encontrada' });
    }

    // Al cerrar la cita: si tiene procedimientos planeados y aún no hay
    // factura ligada, crear una factura preliminar (draft) lista para revisar.
    if (status === 'completed') {
      const existing = await client.query(
        'SELECT id FROM invoices WHERE appointment_id = $1 AND clinic_id = $2 LIMIT 1',
        [rows[0].id, req.clinic!.id]
      );
      if (!existing.rows[0]) {
        const { rows: planned } = await client.query(
          `SELECT ap.procedure_id, ap.quantity, ap.unit_price, ap.position,
             p.name AS procedure_name
           FROM appointment_procedures ap
           JOIN procedures p ON p.id = ap.procedure_id
           WHERE ap.appointment_id = $1
           ORDER BY ap.position ASC, ap.id ASC`,
          [rows[0].id]
        );
        if (planned.length > 0) {
          const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
          let subtotal = 0;
          for (const it of planned) subtotal += (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
          subtotal = round2(subtotal);
          const taxRate = Number(
            (await client.query('SELECT tax_rate FROM clinics WHERE id = $1', [req.clinic!.id]))
              .rows[0]?.tax_rate || 0
          );
          const tax = round2(subtotal * (taxRate / 100));
          const total = round2(subtotal + tax);
          const today = new Date().toISOString().slice(0, 10);

          const c = await client.query('SELECT next_invoice_number FROM clinics WHERE id = $1 FOR UPDATE', [req.clinic!.id]);
          const number = c.rows[0].next_invoice_number;
          await client.query('UPDATE clinics SET next_invoice_number = next_invoice_number + 1 WHERE id = $1', [req.clinic!.id]);

          const inv = await client.query(
            `INSERT INTO invoices
               (clinic_id, number, user_id, doctor_id, appointment_id, type, date,
                subtotal, tax_rate, tax, discount, total, status,
                created_by_email, created_by_name)
             VALUES ($1, $2, $3, $4, $5, 'appointment', $6, $7, $8, $9, 0, $10, 'draft', $11, $12)
             RETURNING id`,
            [req.clinic!.id, number, rows[0].user_id, rows[0].doctor_id, rows[0].id, today,
             subtotal, taxRate, tax, total, req.account!.email, req.account!.name]
          );
          draftInvoiceId = inv.rows[0].id;

          for (let i = 0; i < planned.length; i++) {
            const it = planned[i];
            const qty = round2(Number(it.quantity) || 0);
            const price = round2(Number(it.unit_price) || 0);
            const lineTotal = round2(qty * price);
            await client.query(
              `INSERT INTO invoice_items (invoice_id, procedure_id, description, quantity, unit_price, total, position)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [draftInvoiceId, it.procedure_id, it.procedure_name, qty, price, lineTotal, i]
            );
          }
        }
      }
    }

    await client.query('COMMIT');
  } catch (e: any) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: e.message || 'No se pudo actualizar el estado' });
  } finally {
    client.release();
  }

  const { rows: result } = await pool.query(`${SELECT_WITH_RELATIONS} WHERE a.id = $1`, [req.params.id]);
  const procs = await loadAppointmentProcedures(Number(req.params.id));
  res.json({ ...result[0], procedures: procs, draft_invoice_id: draftInvoiceId });
});

router.delete('/:id', async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    `WITH deleted AS (DELETE FROM appointments WHERE id=$1 AND clinic_id=$2 RETURNING *)
     SELECT deleted.*,
       TO_CHAR(deleted.date, 'YYYY-MM-DD') AS date,
       TO_CHAR(deleted.time, 'HH24:MI') AS time,
       u.name AS user_name, d.name AS doctor_name, d.specialty AS doctor_specialty
     FROM deleted
     JOIN users u ON deleted.user_id = u.id
     JOIN doctors d ON deleted.doctor_id = d.id`,
    [req.params.id, req.clinic!.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Cita no encontrada' });
  res.json(rows[0]);
});

export default router;
