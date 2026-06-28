import { Router, Request, Response } from 'express';
import multer from 'multer';
import pool from '../database';
import { requireAuth, requireClinicMember } from '../auth';
import { requireClinic } from '../tenant';
import { hasStorage, putObject, getSignedDownloadUrl, deleteObject, buildStorageKey } from '../storage';

const router = Router();
router.use(requireClinic, requireAuth, requireClinicMember);

// Multer en memoria para recibir el PDF generado en el cliente (máx 5 MB).
const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('El archivo debe ser PDF'));
  },
});

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

// Calcula los totales de los items y devuelve {subtotal, total} aplicando IVA y descuento.
function computeTotals(items: any[], taxRate: number, discount: number) {
  let subtotal = 0;
  for (const it of items) {
    const qty = Number(it.quantity) || 0;
    const price = Number(it.unit_price) || 0;
    subtotal += qty * price;
  }
  subtotal = round2(subtotal);
  const dsc = round2(Number(discount) || 0);
  const base = Math.max(0, subtotal - dsc);
  const tax = round2(base * ((Number(taxRate) || 0) / 100));
  const total = round2(base + tax);
  return { subtotal, tax, discount: dsc, total };
}

// Decide el estado según el total pagado.
function statusFor(total: number, paid: number, currentStatus: string): string {
  if (currentStatus === 'cancelled') return 'cancelled';
  const p = round2(paid);
  if (p >= round2(total) && total > 0) return 'paid';
  if (p > 0) return 'partial';
  return 'issued';
}

// SELECT de factura con datos relacionados.
const SELECT_INVOICE = `
  SELECT i.id, i.clinic_id, i.number, i.user_id, i.doctor_id, i.appointment_id, i.type,
    TO_CHAR(i.date,'YYYY-MM-DD') AS date,
    i.subtotal, i.tax_rate, i.tax, i.discount, i.total, i.status, i.notes,
    i.pdf_storage_key, i.created_by_email, i.created_by_name, i.created_at,
    u.name AS user_name, u.email AS user_email, u.phone AS user_phone, u.document_id AS user_document_id,
    d.name AS doctor_name, d.specialty AS doctor_specialty,
    COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id = i.id), 0)::numeric AS total_paid
  FROM invoices i
  JOIN users u ON u.id = i.user_id
  LEFT JOIN doctors d ON d.id = i.doctor_id
`;

async function loadItems(invoiceId: number) {
  const { rows } = await pool.query(
    `SELECT ii.*, p.name AS procedure_name
     FROM invoice_items ii
     LEFT JOIN procedures p ON p.id = ii.procedure_id
     WHERE ii.invoice_id = $1 ORDER BY ii.position ASC, ii.id ASC`,
    [invoiceId]
  );
  return rows;
}

async function loadPayments(invoiceId: number) {
  const { rows } = await pool.query(
    `SELECT id, invoice_id, amount, method, reference,
       TO_CHAR(date,'YYYY-MM-DD') AS date,
       notes, received_by_email, received_by_name, created_at
     FROM payments WHERE invoice_id = $1 ORDER BY date DESC, id DESC`,
    [invoiceId]
  );
  return rows;
}

// Lista de facturas, con filtros opcionales: user_id, status, from, to
router.get('/', async (req: Request, res: Response) => {
  const conditions = ['i.clinic_id = $1'];
  const params: any[] = [req.clinic!.id];

  if (req.query.user_id) { params.push(req.query.user_id); conditions.push(`i.user_id = $${params.length}`); }
  if (req.query.status)  { params.push(req.query.status);  conditions.push(`i.status = $${params.length}`); }
  if (req.query.type)    { params.push(req.query.type);    conditions.push(`i.type = $${params.length}`); }
  if (req.query.from)    { params.push(req.query.from);    conditions.push(`i.date >= $${params.length}`); }
  if (req.query.to)      { params.push(req.query.to);      conditions.push(`i.date <= $${params.length}`); }

  const limit = Math.min(Number(req.query.limit) || 100, 500);
  params.push(limit);

  const { rows } = await pool.query(
    `${SELECT_INVOICE} WHERE ${conditions.join(' AND ')} ORDER BY i.date DESC, i.number DESC LIMIT $${params.length}`,
    params
  );
  res.json(rows);
});

// Detalle de factura: incluye items + payments
router.get('/:id', async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    `${SELECT_INVOICE} WHERE i.id = $1 AND i.clinic_id = $2`,
    [req.params.id, req.clinic!.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Factura no encontrada' });
  const [items, payments] = await Promise.all([loadItems(rows[0].id), loadPayments(rows[0].id)]);
  res.json({ ...rows[0], items, payments });
});

// Crear factura.
// Body: { user_id, doctor_id?, appointment_id?, type?, date?, tax_rate?, discount?, notes?,
//         items: [{procedure_id?, description, quantity, unit_price}] }
// type:
//   - 'appointment' (default): debe llegar appointment_id válido para el paciente.
//   - 'supply': venta de insumos / productos sin cita; appointment_id se ignora.
router.post('/', async (req: Request, res: Response) => {
  const { user_id, doctor_id, appointment_id, date, tax_rate, discount, notes, items } = req.body;
  const type: 'appointment' | 'supply' = req.body.type === 'supply' ? 'supply' : 'appointment';
  if (!user_id) return res.status(400).json({ error: 'Falta el paciente' });
  if (type === 'appointment' && !appointment_id) {
    return res.status(400).json({ error: 'La factura debe estar asociada a una cita' });
  }
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'La factura debe tener al menos un ítem' });

  // Verifica que el paciente exista en la clínica
  const u = await pool.query('SELECT 1 FROM users WHERE id = $1 AND clinic_id = $2', [user_id, req.clinic!.id]);
  if (!u.rows[0]) return res.status(404).json({ error: 'Paciente no encontrado' });

  // Para facturas de cita: verifica que pertenezca a la clínica y al paciente.
  // Para venta de insumos: no se vincula a una cita (constraint del DB lo exige).
  let appointmentRef: number | null = null;
  if (type === 'appointment') {
    const ap = await pool.query(
      'SELECT 1 FROM appointments WHERE id = $1 AND clinic_id = $2 AND user_id = $3',
      [appointment_id, req.clinic!.id, user_id]
    );
    if (!ap.rows[0]) return res.status(404).json({ error: 'La cita no existe o no pertenece a este paciente' });
    appointmentRef = appointment_id;
  }

  const today = new Date().toISOString().slice(0, 10);
  const useDate = date || today;
  const useTaxRate = tax_rate !== undefined && tax_rate !== null
    ? Number(tax_rate)
    : Number((await pool.query('SELECT tax_rate FROM clinics WHERE id = $1', [req.clinic!.id])).rows[0]?.tax_rate || 0);
  const useDiscount = round2(Number(discount) || 0);

  const totals = computeTotals(items, useTaxRate, useDiscount);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Bloquea la fila de la clínica para tomar el siguiente número de factura
    const c = await client.query('SELECT next_invoice_number FROM clinics WHERE id = $1 FOR UPDATE', [req.clinic!.id]);
    const number = c.rows[0].next_invoice_number;
    await client.query('UPDATE clinics SET next_invoice_number = next_invoice_number + 1 WHERE id = $1', [req.clinic!.id]);

    const inv = await client.query(
      `INSERT INTO invoices
         (clinic_id, number, user_id, doctor_id, appointment_id, type, date,
          subtotal, tax_rate, tax, discount, total, status, notes,
          created_by_email, created_by_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'issued', $13, $14, $15)
       RETURNING id`,
      [req.clinic!.id, number, user_id, doctor_id || null, appointmentRef, type, useDate,
       totals.subtotal, useTaxRate, totals.tax, totals.discount, totals.total, notes || null,
       req.account!.email, req.account!.name]
    );
    const invoiceId = inv.rows[0].id;

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const qty = round2(Number(it.quantity) || 0);
      const price = round2(Number(it.unit_price) || 0);
      const total = round2(qty * price);
      const desc = (it.description || '').trim();
      if (!desc) throw new Error('Cada ítem necesita una descripción');
      await client.query(
        `INSERT INTO invoice_items (invoice_id, procedure_id, description, quantity, unit_price, total, position)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [invoiceId, it.procedure_id || null, desc, qty, price, total, i]
      );
    }

    await client.query('COMMIT');

    // Vuelve a leer con relaciones
    const r = await pool.query(`${SELECT_INVOICE} WHERE i.id = $1`, [invoiceId]);
    const [its, pays] = await Promise.all([loadItems(invoiceId), loadPayments(invoiceId)]);
    res.status(201).json({ ...r.rows[0], items: its, payments: pays });
  } catch (e: any) {
    await client.query('ROLLBACK');
    console.error('Error creando factura:', e);
    res.status(500).json({ error: e.message || 'No se pudo crear la factura' });
  } finally {
    client.release();
  }
});

// Editar una factura. Solo permitido en estado 'draft' (borrador preliminar).
// Reemplaza items, recalcula totales y permite ajustar tax_rate, discount y notas.
// No toca user_id, doctor_id, appointment_id, type, number ni date original.
router.put('/:id', async (req: Request, res: Response) => {
  const { tax_rate, discount, notes, items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'La factura debe tener al menos un ítem' });
  }

  const current = await pool.query(
    'SELECT status FROM invoices WHERE id = $1 AND clinic_id = $2',
    [req.params.id, req.clinic!.id]
  );
  if (!current.rows[0]) return res.status(404).json({ error: 'Factura no encontrada' });
  if (current.rows[0].status !== 'draft') {
    return res.status(409).json({ error: 'Solo se puede editar una factura en borrador' });
  }

  const useTaxRate = tax_rate !== undefined && tax_rate !== null ? Number(tax_rate) : 0;
  const useDiscount = round2(Number(discount) || 0);
  const totals = computeTotals(items, useTaxRate, useDiscount);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE invoices SET
         subtotal = $1, tax_rate = $2, tax = $3, discount = $4, total = $5, notes = $6
       WHERE id = $7 AND clinic_id = $8`,
      [totals.subtotal, useTaxRate, totals.tax, totals.discount, totals.total,
       notes ?? null, req.params.id, req.clinic!.id]
    );
    await client.query('DELETE FROM invoice_items WHERE invoice_id = $1', [req.params.id]);
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const qty = round2(Number(it.quantity) || 0);
      const price = round2(Number(it.unit_price) || 0);
      const total = round2(qty * price);
      const desc = (it.description || '').trim();
      if (!desc) throw new Error('Cada ítem necesita una descripción');
      await client.query(
        `INSERT INTO invoice_items (invoice_id, procedure_id, description, quantity, unit_price, total, position)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [req.params.id, it.procedure_id || null, desc, qty, price, total, i]
      );
    }
    await client.query('COMMIT');

    const r = await pool.query(`${SELECT_INVOICE} WHERE i.id = $1`, [req.params.id]);
    const [its, pays] = await Promise.all([loadItems(Number(req.params.id)), loadPayments(Number(req.params.id))]);
    res.json({ ...r.rows[0], items: its, payments: pays });
  } catch (e: any) {
    await client.query('ROLLBACK');
    console.error('Error editando factura:', e);
    res.status(500).json({ error: e.message || 'No se pudo editar la factura' });
  } finally {
    client.release();
  }
});

// Cambiar estado (típicamente para cancelar o emitir desde borrador)
router.patch('/:id/status', async (req: Request, res: Response) => {
  const { status } = req.body;
  if (!['draft', 'issued', 'partial', 'paid', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }
  const { rows } = await pool.query(
    'UPDATE invoices SET status = $1 WHERE id = $2 AND clinic_id = $3 RETURNING id',
    [status, req.params.id, req.clinic!.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Factura no encontrada' });
  res.json({ id: rows[0].id, status });
});

router.delete('/:id', async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    'DELETE FROM invoices WHERE id = $1 AND clinic_id = $2 RETURNING id, number',
    [req.params.id, req.clinic!.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Factura no encontrada' });
  res.json(rows[0]);
});

// ── Abonos ───────────────────────────────────────────────────────────────

router.post('/:id/payments', async (req: Request, res: Response) => {
  const { amount, method, reference, date, notes } = req.body;
  const amt = round2(Number(amount) || 0);
  if (amt <= 0) return res.status(400).json({ error: 'El monto debe ser mayor que cero' });
  if (!['cash', 'card', 'transfer', 'other'].includes(method)) {
    return res.status(400).json({ error: 'Método de pago inválido' });
  }

  // Verifica que la factura existe en esta clínica
  const inv = await pool.query(
    `SELECT i.total, COALESCE(SUM(p.amount), 0)::numeric AS paid, i.status
     FROM invoices i LEFT JOIN payments p ON p.invoice_id = i.id
     WHERE i.id = $1 AND i.clinic_id = $2
     GROUP BY i.id, i.total, i.status`,
    [req.params.id, req.clinic!.id]
  );
  if (!inv.rows[0]) return res.status(404).json({ error: 'Factura no encontrada' });
  if (inv.rows[0].status === 'cancelled') return res.status(400).json({ error: 'La factura está cancelada' });

  const today = new Date().toISOString().slice(0, 10);
  const { rows } = await pool.query(
    `INSERT INTO payments (clinic_id, invoice_id, amount, method, reference, date, notes,
       received_by_email, received_by_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, invoice_id, amount, method, reference, TO_CHAR(date,'YYYY-MM-DD') AS date,
       notes, received_by_email, received_by_name, created_at`,
    [req.clinic!.id, req.params.id, amt, method, reference || null, date || today, notes || null,
     req.account!.email, req.account!.name]
  );

  // Recalcular estado
  const newPaid = round2(Number(inv.rows[0].paid) + amt);
  const newStatus = statusFor(Number(inv.rows[0].total), newPaid, inv.rows[0].status);
  await pool.query('UPDATE invoices SET status = $1 WHERE id = $2', [newStatus, req.params.id]);

  res.status(201).json(rows[0]);
});

router.delete('/:id/payments/:pid', async (req: Request, res: Response) => {
  const del = await pool.query(
    `DELETE FROM payments WHERE id = $1 AND invoice_id = $2 AND clinic_id = $3 RETURNING amount`,
    [req.params.pid, req.params.id, req.clinic!.id]
  );
  if (!del.rows[0]) return res.status(404).json({ error: 'Abono no encontrado' });

  // Recalcular estado
  const inv = await pool.query(
    `SELECT i.total, COALESCE(SUM(p.amount),0)::numeric AS paid, i.status
     FROM invoices i LEFT JOIN payments p ON p.invoice_id = i.id
     WHERE i.id = $1 GROUP BY i.id`,
    [req.params.id]
  );
  if (inv.rows[0]) {
    const newStatus = statusFor(Number(inv.rows[0].total), Number(inv.rows[0].paid), inv.rows[0].status);
    await pool.query('UPDATE invoices SET status = $1 WHERE id = $2', [newStatus, req.params.id]);
  }

  res.json({ id: req.params.pid });
});

// ── PDF de la factura ───────────────────────────────────────────────────
// Sube el PDF generado en el cliente y lo guarda en R2. Reemplaza el
// anterior si ya existía (sube el nuevo y borra el viejo del bucket).
router.post('/:id/pdf', pdfUpload.single('file'), async (req: Request, res: Response) => {
  if (!hasStorage()) return res.status(503).json({ error: 'Almacenamiento no configurado' });
  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) return res.status(400).json({ error: 'No se envió ningún PDF' });

  const inv = await pool.query(
    'SELECT user_id, pdf_storage_key FROM invoices WHERE id = $1 AND clinic_id = $2',
    [req.params.id, req.clinic!.id]
  );
  if (!inv.rows[0]) return res.status(404).json({ error: 'Factura no encontrada' });

  const oldKey: string | null = inv.rows[0].pdf_storage_key;
  const key = buildStorageKey(req.clinic!.slug, inv.rows[0].user_id, `factura-${req.params.id}.pdf`);
  try {
    await putObject(key, file.buffer, 'application/pdf');
  } catch (e) {
    console.error('Error subiendo PDF de factura a R2:', e);
    return res.status(502).json({ error: 'No se pudo subir el PDF' });
  }
  await pool.query('UPDATE invoices SET pdf_storage_key = $1 WHERE id = $2', [key, req.params.id]);
  // Borrar el PDF anterior si existía (en background, sin bloquear la respuesta)
  if (oldKey && oldKey !== key) deleteObject(oldKey).catch(err => console.error('Error borrando PDF previo:', err));
  res.json({ ok: true });
});

// URL firmada (inline) para abrir el PDF en otra pestaña.
router.get('/:id/pdf', async (req: Request, res: Response) => {
  if (!hasStorage()) return res.status(503).json({ error: 'Almacenamiento no configurado' });
  const inv = await pool.query(
    'SELECT pdf_storage_key, number FROM invoices WHERE id = $1 AND clinic_id = $2',
    [req.params.id, req.clinic!.id]
  );
  if (!inv.rows[0]) return res.status(404).json({ error: 'Factura no encontrada' });
  if (!inv.rows[0].pdf_storage_key) return res.status(404).json({ error: 'Esta factura no tiene PDF generado' });
  try {
    const url = await getSignedDownloadUrl(inv.rows[0].pdf_storage_key, `factura-${String(inv.rows[0].number).padStart(4, '0')}.pdf`, 'inline');
    res.json({ url });
  } catch (e) {
    console.error('Error firmando PDF de factura:', e);
    res.status(502).json({ error: 'No se pudo generar el enlace del PDF' });
  }
});

export default router;
