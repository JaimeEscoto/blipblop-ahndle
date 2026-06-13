import { jsPDF } from 'jspdf';
import { Appointment } from '../api/client';

export function generateAppointmentPDF(appt: Appointment) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  const H = 297;

  // ── Paleta editorial ────────────────────────────────────
  const cream   = [250, 248, 243] as [number, number, number]; // fondo
  const charcoal= [38, 42, 51]    as [number, number, number]; // texto principal
  const gold    = [176, 141, 87]  as [number, number, number]; // acento
  const goldSoft= [201, 175, 133] as [number, number, number]; // acento suave
  const muted   = [120, 120, 115] as [number, number, number]; // texto secundario
  const line    = [210, 203, 190] as [number, number, number]; // líneas finas

  // ── Fondo crema a página completa ───────────────────────
  doc.setFillColor(...cream);
  doc.rect(0, 0, W, H, 'F');

  // ── Doble marco dorado ──────────────────────────────────
  doc.setDrawColor(...gold);
  doc.setLineWidth(0.8);
  doc.rect(12, 12, W - 24, H - 24);
  doc.setLineWidth(0.2);
  doc.rect(15, 15, W - 30, H - 30);

  const cx = W / 2;

  // ── Esquinas ornamentales ───────────────────────────────
  const corner = (x: number, y: number, dx: number, dy: number) => {
    doc.setDrawColor(...goldSoft);
    doc.setLineWidth(0.4);
    doc.line(x, y, x + dx * 6, y);
    doc.line(x, y, x, y + dy * 6);
  };
  corner(15, 15, 1, 1);
  corner(W - 15, 15, -1, 1);
  corner(15, H - 15, 1, -1);
  corner(W - 15, H - 15, -1, -1);

  // ── Encabezado: nombre de la clínica (versalitas) ───────
  doc.setFont('times', 'normal');
  doc.setTextColor(...gold);
  doc.setFontSize(11);
  doc.text('C L Í N I C A   P R O', cx, 32, { align: 'center', charSpace: 1 });

  // Espacio para logo (círculo sutil)
  doc.setDrawColor(...goldSoft);
  doc.setLineWidth(0.4);
  doc.circle(cx, 50, 12);
  doc.setFontSize(6.5);
  doc.setTextColor(...muted);
  doc.text('LOGO', cx, 51, { align: 'center', charSpace: 0.5 });

  // ── Filete con rombo central ────────────────────────────
  const ornRule = (y: number, half = 30) => {
    doc.setDrawColor(...goldSoft);
    doc.setLineWidth(0.3);
    doc.line(cx - half, y, cx - 4, y);
    doc.line(cx + 4, y, cx + half, y);
    doc.setFillColor(...gold);
    doc.triangle(cx, y - 1.4, cx - 1.4, y, cx, y + 1.4, 'F');
    doc.triangle(cx, y - 1.4, cx + 1.4, y, cx, y + 1.4, 'F');
  };
  ornRule(70, 26);

  // ── Titular tipo invitación ─────────────────────────────
  doc.setFont('times', 'italic');
  doc.setTextColor(...muted);
  doc.setFontSize(13);
  doc.text('Tenemos el gusto de confirmar su', cx, 84, { align: 'center' });

  doc.setFont('times', 'normal');
  doc.setTextColor(...charcoal);
  doc.setFontSize(40);
  doc.text('Cita Médica', cx, 100, { align: 'center', charSpace: 0.5 });

  ornRule(112, 26);

  // ── Nombre del paciente, protagonista ───────────────────
  doc.setFont('times', 'italic');
  doc.setTextColor(...muted);
  doc.setFontSize(11);
  doc.text('Estimado(a)', cx, 128, { align: 'center' });

  doc.setFont('times', 'normal');
  doc.setTextColor(...gold);
  doc.setFontSize(24);
  doc.text(appt.user_name, cx, 140, { align: 'center', charSpace: 0.3 });

  // ── Fecha y hora destacadas ─────────────────────────────
  const fecha = new Date(appt.date + 'T00:00:00').toLocaleDateString('es-CO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const fechaCap = fecha.charAt(0).toUpperCase() + fecha.slice(1);

  doc.setFont('times', 'normal');
  doc.setTextColor(...charcoal);
  doc.setFontSize(15);
  doc.text(fechaCap, cx, 158, { align: 'center' });

  // Hora con líneas a los lados
  doc.setDrawColor(...line);
  doc.setLineWidth(0.3);
  doc.line(cx - 40, 167, cx - 16, 167);
  doc.line(cx + 16, 167, cx + 40, 167);
  doc.setFont('times', 'normal');
  doc.setTextColor(...gold);
  doc.setFontSize(18);
  doc.text(appt.time + ' h', cx, 169, { align: 'center', charSpace: 1 });

  // ── Bloque de detalles (médico, motivo) ─────────────────
  let y = 188;
  const detailRow = (label: string, value: string) => {
    if (!value) return;
    doc.setFont('times', 'italic');
    doc.setTextColor(...muted);
    doc.setFontSize(9.5);
    doc.text(label.toUpperCase(), cx, y, { align: 'center', charSpace: 1.5 });
    doc.setFont('times', 'normal');
    doc.setTextColor(...charcoal);
    doc.setFontSize(13);
    const lines = doc.splitTextToSize(value, 150);
    doc.text(lines, cx, y + 6, { align: 'center' });
    y += 8 + lines.length * 6;
  };

  detailRow('Profesional', `Dr. ${appt.doctor_name}`);
  detailRow('Especialidad', appt.doctor_specialty);
  if (appt.reason) detailRow('Motivo de la consulta', appt.reason);
  if (appt.notes)  detailRow('Notas', appt.notes);

  ornRule(Math.min(y + 2, 244), 22);

  // ── Indicaciones discretas ──────────────────────────────
  doc.setFont('times', 'italic');
  doc.setTextColor(...muted);
  doc.setFontSize(9);
  const nota = 'Le agradecemos llegar diez minutos antes y presentar este documento junto con su identificación.';
  doc.text(doc.splitTextToSize(nota, 130), cx, 254, { align: 'center' });

  // ── Pie ─────────────────────────────────────────────────
  doc.setFont('times', 'normal');
  doc.setTextColor(...gold);
  doc.setFontSize(8);
  doc.text('C L Í N I C A   P R O', cx, 272, { align: 'center', charSpace: 1 });
  doc.setFont('times', 'italic');
  doc.setTextColor(...muted);
  doc.setFontSize(7);
  doc.text(
    `Cita N.º ${appt.id}  ·  Emitido el ${new Date().toLocaleDateString('es-CO')}`,
    cx, 278, { align: 'center' }
  );

  // ── Descarga ────────────────────────────────────────────
  const safeName = appt.user_name.replace(/\s+/g, '_');
  doc.save(`Invitacion_Cita_${safeName}_${appt.date}.pdf`);
}
