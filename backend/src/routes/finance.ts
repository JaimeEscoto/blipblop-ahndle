import { Router, Request, Response } from 'express';
import pool from '../database';
import { requireAuth, requireClinicMember } from '../auth';
import { requireClinic } from '../tenant';

const router = Router();
router.use(requireClinic, requireAuth, requireClinicMember);

// ── Ajustes financieros de la clínica ────────────────────────────────────

router.get('/settings', async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    'SELECT currency, tax_rate, next_invoice_number FROM clinics WHERE id = $1',
    [req.clinic!.id]
  );
  res.json(rows[0] || { currency: 'HNL', tax_rate: 0, next_invoice_number: 1 });
});

router.put('/settings', async (req: Request, res: Response) => {
  if (req.account?.role !== 'clinic_admin' && req.account?.role !== 'superuser') {
    return res.status(403).json({ error: 'Solo el administrador puede cambiar la moneda y los impuestos' });
  }
  const currency = (req.body.currency || 'HNL').toString().toUpperCase().slice(0, 6);
  const taxRate = Math.max(0, Math.min(100, Number(req.body.tax_rate) || 0));
  const { rows } = await pool.query(
    `UPDATE clinics SET currency = $1, tax_rate = $2 WHERE id = $3
     RETURNING currency, tax_rate, next_invoice_number`,
    [currency, taxRate, req.clinic!.id]
  );
  res.json(rows[0]);
});

// Saldos de TODOS los pacientes (para listas). Solo devuelve los que tienen
// alguna factura, así no infla la respuesta innecesariamente.
router.get('/balances', async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    `SELECT i.user_id,
       COALESCE(SUM(CASE WHEN i.status <> 'cancelled' THEN i.total END), 0)::numeric AS total_invoiced,
       COALESCE(SUM(CASE WHEN i.status <> 'cancelled' THEN
         (SELECT COALESCE(SUM(amount),0) FROM payments WHERE invoice_id = i.id)
       END), 0)::numeric AS total_paid,
       COUNT(*) FILTER (WHERE i.status IN ('issued','partial'))::int AS pending_count
     FROM invoices i
     WHERE i.clinic_id = $1
     GROUP BY i.user_id`,
    [req.clinic!.id]
  );
  const out = rows.map(r => ({
    user_id: Number(r.user_id),
    total_invoiced: Number(r.total_invoiced),
    total_paid: Number(r.total_paid),
    balance: Math.round((Number(r.total_invoiced) - Number(r.total_paid)) * 100) / 100,
    pending_count: r.pending_count,
  }));
  res.json(out);
});

// ── Estado de cuenta de un paciente ──────────────────────────────────────

router.get('/balance/:userId', async (req: Request, res: Response) => {
  const u = await pool.query('SELECT 1 FROM users WHERE id = $1 AND clinic_id = $2', [req.params.userId, req.clinic!.id]);
  if (!u.rows[0]) return res.status(404).json({ error: 'Paciente no encontrado' });

  const { rows } = await pool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN status <> 'cancelled' THEN total END), 0)::numeric AS total_invoiced,
       COALESCE(SUM(CASE WHEN status <> 'cancelled' THEN
         (SELECT COALESCE(SUM(amount),0) FROM payments WHERE invoice_id = invoices.id)
       END), 0)::numeric AS total_paid,
       COUNT(*) FILTER (WHERE status <> 'cancelled')::int AS invoices_count,
       COUNT(*) FILTER (WHERE status IN ('issued','partial'))::int AS pending_count
     FROM invoices
     WHERE clinic_id = $1 AND user_id = $2`,
    [req.clinic!.id, req.params.userId]
  );
  const r = rows[0];
  const balance = Number(r.total_invoiced) - Number(r.total_paid);
  res.json({
    total_invoiced: Number(r.total_invoiced),
    total_paid: Number(r.total_paid),
    balance: Math.round(balance * 100) / 100,
    invoices_count: r.invoices_count,
    pending_count: r.pending_count,
  });
});

// ── Reporte de ingresos ──────────────────────────────────────────────────

router.get('/report', async (req: Request, res: Response) => {
  const today = new Date().toISOString().slice(0, 10);
  const startMonth = today.slice(0, 8) + '01';
  const from = (req.query.from as string) || startMonth;
  const to = (req.query.to as string) || today;
  const clinicId = req.clinic!.id;

  // 1) Resumen general
  const summary = await pool.query(
    `SELECT
       COALESCE(SUM(p.amount), 0)::numeric AS total_income,
       COUNT(DISTINCT p.invoice_id)::int AS invoices_paid,
       COUNT(p.id)::int AS payments_count
     FROM payments p
     WHERE p.clinic_id = $1 AND p.date BETWEEN $2 AND $3`,
    [clinicId, from, to]
  );

  // 2) Cuentas por cobrar (no acotado por fecha)
  const receivable = await pool.query(
    `SELECT
       COALESCE(SUM(i.total - COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id = i.id), 0)), 0)::numeric AS receivable,
       COUNT(*)::int AS pending_invoices
     FROM invoices i
     WHERE i.clinic_id = $1 AND i.status IN ('issued', 'partial')`,
    [clinicId]
  );

  // 3) Por método de pago
  const byMethod = await pool.query(
    `SELECT method, COALESCE(SUM(amount),0)::numeric AS total, COUNT(*)::int AS count
     FROM payments WHERE clinic_id = $1 AND date BETWEEN $2 AND $3
     GROUP BY method ORDER BY total DESC`,
    [clinicId, from, to]
  );

  // 4) Por médico (basado en facturas con abonos en el rango)
  const byDoctor = await pool.query(
    `SELECT d.id, d.name, COALESCE(SUM(p.amount),0)::numeric AS total
     FROM payments p
     JOIN invoices i ON i.id = p.invoice_id
     LEFT JOIN doctors d ON d.id = i.doctor_id
     WHERE p.clinic_id = $1 AND p.date BETWEEN $2 AND $3
     GROUP BY d.id, d.name ORDER BY total DESC`,
    [clinicId, from, to]
  );

  // 5) Top procedimientos (facturas emitidas en el rango)
  const byProcedure = await pool.query(
    `SELECT COALESCE(p.name, ii.description) AS name,
       SUM(ii.quantity)::numeric AS quantity,
       SUM(ii.total)::numeric AS total
     FROM invoice_items ii
     LEFT JOIN procedures p ON p.id = ii.procedure_id
     JOIN invoices i ON i.id = ii.invoice_id
     WHERE i.clinic_id = $1 AND i.date BETWEEN $2 AND $3 AND i.status <> 'cancelled'
     GROUP BY COALESCE(p.name, ii.description)
     ORDER BY total DESC LIMIT 10`,
    [clinicId, from, to]
  );

  // 6) Ingresos por día (para gráfica)
  const byDay = await pool.query(
    `SELECT TO_CHAR(date, 'YYYY-MM-DD') AS day, COALESCE(SUM(amount),0)::numeric AS total
     FROM payments
     WHERE clinic_id = $1 AND date BETWEEN $2 AND $3
     GROUP BY day ORDER BY day ASC`,
    [clinicId, from, to]
  );

  res.json({
    from, to,
    summary: summary.rows[0],
    receivable: receivable.rows[0],
    by_method: byMethod.rows,
    by_doctor: byDoctor.rows,
    by_procedure: byProcedure.rows,
    by_day: byDay.rows,
  });
});

export default router;
