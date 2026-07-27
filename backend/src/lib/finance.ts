// Cálculos financieros puros (sin acceso a BD ni a Express), extraídos de las
// rutas para poder probarlos de forma aislada. Las rutas de facturas, finanzas
// y planes de tratamiento importan estas funciones para que el dinero se
// calcule en un solo lugar.

export type InvoiceStatus = 'draft' | 'issued' | 'partial' | 'paid' | 'cancelled';

export interface InvoiceItemInput {
  quantity?: number | string | null;
  unit_price?: number | string | null;
  [k: string]: any;
}

export interface InvoiceTotals {
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
}

// Redondea a 2 decimales tolerando null/undefined/strings. Un valor no numérico
// se trata como 0 (nunca NaN).
export const round2 = (n: number | string | null | undefined): number =>
  Math.round((Number(n) || 0) * 100) / 100;

// Calcula los totales de los items aplicando descuento (sobre el subtotal) e
// IVA (sobre la base ya descontada). El descuento nunca deja la base negativa.
export function computeTotals(
  items: InvoiceItemInput[],
  taxRate: number | string | null | undefined,
  discount: number | string | null | undefined
): InvoiceTotals {
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

// Decide el estado de una factura según lo pagado. Una factura cancelada
// permanece cancelada. Se considera pagada solo si el total es > 0 y lo
// abonado lo cubre; parcial si hay algún abono; emitida en otro caso.
export function statusFor(
  total: number | string | null | undefined,
  paid: number | string | null | undefined,
  currentStatus: string
): InvoiceStatus {
  if (currentStatus === 'cancelled') return 'cancelled';
  const p = round2(paid);
  const t = round2(total);
  if (p >= t && t > 0) return 'paid';
  if (p > 0) return 'partial';
  return 'issued';
}

// Saldo pendiente de un paciente/factura: facturado menos pagado, a 2 decimales.
export function computeBalance(
  totalInvoiced: number | string | null | undefined,
  totalPaid: number | string | null | undefined
): number {
  return round2((Number(totalInvoiced) || 0) - (Number(totalPaid) || 0));
}

// Ajusta una tasa de impuesto al rango [0, 100]. Valores no numéricos → 0.
export function clampTaxRate(value: number | string | null | undefined): number {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

// ── Planes de tratamiento ────────────────────────────────────────────────

// Un plan siempre tiene al menos 1 sesión.
export function clampSessions(value: number | string | null | undefined): number {
  return Math.max(1, Number(value) || 1);
}

// El monto total nunca es negativo. No numérico → 0.
export function clampTotalAmount(value: number | string | null | undefined): number {
  return Math.max(0, Number(value) || 0);
}

// El intervalo en semanas nunca es negativo. No numérico → 0.
export function clampIntervalWeeks(value: number | string | null | undefined): number {
  return Math.max(0, Number(value) || 0);
}

// Reparte el total entre las sesiones, redondeado a 2 decimales.
export function perSessionAmount(total: number, sessions: number): number {
  return round2(sessions > 0 ? total / sessions : 0);
}
