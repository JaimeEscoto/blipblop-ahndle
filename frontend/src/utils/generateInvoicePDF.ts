import { jsPDF } from 'jspdf';
import { InvoiceDetail } from '../api/client';
import { formatMoney, currencySymbol } from './money';

async function loadImageDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise<string | null>(resolve => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch { return null; }
}

const PAY_METHODS: Record<string, string> = {
  cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', other: 'Otro',
};
const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador', issued: 'Emitida', partial: 'Parcial', paid: 'Pagada', cancelled: 'Anulada',
};

// Construye un PDF tipo recibo (carta vertical) y lo devuelve como Blob.
export async function generateInvoicePDF(
  invoice: InvoiceDetail,
  clinic: { name: string; slug: string; currency: string },
): Promise<Blob> {
  const W = 210, H = 297; // A4 vertical (mm)
  const doc = new jsPDF({ unit: 'mm', format: [W, H], orientation: 'portrait' });

  const navy    = [15, 47, 79]   as [number, number, number];
  const ink     = [30, 41, 59]   as [number, number, number];
  const gray    = [100, 116, 139] as [number, number, number];
  const grayLite= [241, 245, 249] as [number, number, number];
  const white   = [255, 255, 255] as [number, number, number];

  const logoData = await loadImageDataUrl('/icono.png');

  // ── Encabezado ──────────────────────────────────────────
  doc.setFillColor(...navy);
  doc.rect(0, 0, W, 32, 'F');

  if (logoData) {
    doc.addImage(logoData, 'PNG', 12, 7, 18, 18);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...white);
  doc.text(clinic.name, 34, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`odontiacloud.com/${clinic.slug}`, 34, 20);

  // Bloque "FACTURA #0001" arriba a la derecha
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('FACTURA', W - 12, 14, { align: 'right' });
  doc.setFontSize(11);
  doc.text(`#${String(invoice.number).padStart(4, '0')}`, W - 12, 20, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Estado: ${STATUS_LABEL[invoice.status] || invoice.status}`, W - 12, 25, { align: 'right' });

  // ── Datos del paciente y la cita ────────────────────────
  let y = 44;
  doc.setTextColor(...ink);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('FACTURADO A', 12, y);
  doc.text('DETALLES', W / 2 + 6, y);
  y += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(invoice.user_name, 12, y);
  doc.setFontSize(11);
  doc.text(`Fecha: ${invoice.date}`, W / 2 + 6, y);
  y += 5;

  doc.setFontSize(9);
  doc.setTextColor(...gray);
  if (invoice.user_document_id) { doc.text(`Documento: ${invoice.user_document_id}`, 12, y); }
  doc.text(`Cita #${invoice.appointment_id ?? '-'}`, W / 2 + 6, y);
  y += 4.5;
  if (invoice.user_email) { doc.text(invoice.user_email, 12, y); }
  if (invoice.doctor_name) { doc.text(`Dr. ${invoice.doctor_name}`, W / 2 + 6, y); }
  y += 4.5;
  if (invoice.user_phone) { doc.text(invoice.user_phone, 12, y); }
  if (invoice.doctor_specialty) { doc.text(invoice.doctor_specialty, W / 2 + 6, y); }

  // ── Tabla de items ──────────────────────────────────────
  y = 84;
  doc.setFillColor(...navy);
  doc.rect(12, y, W - 24, 8, 'F');
  doc.setTextColor(...white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('DESCRIPCIÓN', 14, y + 5.5);
  doc.text('CANT', W - 76, y + 5.5, { align: 'right' });
  doc.text('PRECIO', W - 50, y + 5.5, { align: 'right' });
  doc.text('TOTAL', W - 14, y + 5.5, { align: 'right' });
  y += 8;

  doc.setTextColor(...ink);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  let zebra = false;
  for (const it of invoice.items) {
    if (zebra) {
      doc.setFillColor(...grayLite);
      doc.rect(12, y, W - 24, 7, 'F');
    }
    zebra = !zebra;
    const desc = it.description.length > 80 ? it.description.slice(0, 77) + '…' : it.description;
    doc.text(desc, 14, y + 5);
    doc.text(String(Number(it.quantity)), W - 76, y + 5, { align: 'right' });
    doc.text(Number(it.unit_price).toFixed(2), W - 50, y + 5, { align: 'right' });
    doc.text(Number(it.total).toFixed(2), W - 14, y + 5, { align: 'right' });
    y += 7;
  }

  // ── Totales ─────────────────────────────────────────────
  y += 4;
  const totalX1 = W / 2 + 30;
  const totalX2 = W - 14;
  doc.setFontSize(9);
  doc.setTextColor(...gray);
  doc.text('Subtotal', totalX1, y, { align: 'right' });
  doc.setTextColor(...ink);
  doc.text(formatMoney(invoice.subtotal, clinic.currency), totalX2, y, { align: 'right' });
  y += 5;
  if (Number(invoice.discount) > 0) {
    doc.setTextColor(...gray);
    doc.text('Descuento', totalX1, y, { align: 'right' });
    doc.setTextColor(...ink);
    doc.text(`- ${formatMoney(invoice.discount, clinic.currency)}`, totalX2, y, { align: 'right' });
    y += 5;
  }
  if (Number(invoice.tax) > 0) {
    doc.setTextColor(...gray);
    doc.text(`IVA (${invoice.tax_rate}%)`, totalX1, y, { align: 'right' });
    doc.setTextColor(...ink);
    doc.text(formatMoney(invoice.tax, clinic.currency), totalX2, y, { align: 'right' });
    y += 5;
  }
  // Total grande
  y += 2;
  doc.setDrawColor(...navy);
  doc.setLineWidth(0.4);
  doc.line(totalX1 - 30, y, totalX2, y);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...navy);
  doc.text('TOTAL', totalX1, y, { align: 'right' });
  doc.text(formatMoney(invoice.total, clinic.currency), totalX2, y, { align: 'right' });

  // ── Abonos ──────────────────────────────────────────────
  if (invoice.payments.length > 0) {
    y += 12;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...ink);
    doc.text('ABONOS', 12, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...gray);
    for (const p of invoice.payments) {
      const line = `${p.date} · ${PAY_METHODS[p.method] || p.method} · ${formatMoney(p.amount, clinic.currency)}${p.reference ? ` · Ref ${p.reference}` : ''}`;
      doc.text(line, 12, y);
      y += 4.5;
    }
    const balance = Number(invoice.total) - Number(invoice.total_paid);
    y += 3;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...(balance > 0.01 ? [180, 83, 9] as [number, number, number] : [22, 101, 52] as [number, number, number]));
    doc.text(
      balance > 0.01 ? `Saldo pendiente: ${formatMoney(balance, clinic.currency)}` : 'PAGADA TOTALMENTE',
      W - 14, y, { align: 'right' }
    );
  }

  // ── Notas ───────────────────────────────────────────────
  if (invoice.notes) {
    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...ink);
    doc.text('NOTAS', 12, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...gray);
    const lines = doc.splitTextToSize(invoice.notes, W - 24);
    doc.text(lines, 12, y);
  }

  // ── Pie ─────────────────────────────────────────────────
  doc.setFontSize(7);
  doc.setTextColor(...gray);
  doc.text(
    `Generado el ${new Date().toLocaleString('es-ES')} · Moneda: ${currencySymbol(clinic.currency)} ${clinic.currency.toUpperCase()}`,
    W / 2, H - 8, { align: 'center' }
  );

  return doc.output('blob');
}
