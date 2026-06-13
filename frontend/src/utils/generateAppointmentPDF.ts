import { jsPDF } from 'jspdf';
import { Appointment } from '../api/client';

export function generateAppointmentPDF(appt: Appointment) {
  // Tarjeta horizontal compacta (tipo postal / revista)
  const W = 190;
  const H = 110;
  const doc = new jsPDF({ unit: 'mm', format: [W, H], orientation: 'landscape' });

  // ── Paleta azul + gris ──────────────────────────────────
  const blue     = [37, 99, 235]   as [number, number, number];
  const blueDark = [29, 58, 138]   as [number, number, number];
  const blueSoft = [219, 234, 254] as [number, number, number];
  const gray     = [71, 85, 105]   as [number, number, number];
  const grayLite = [241, 245, 249] as [number, number, number];
  const grayMid  = [148, 163, 184] as [number, number, number];
  const white    = [255, 255, 255] as [number, number, number];
  const ink       = [30, 41, 59]   as [number, number, number];

  // ── Fondo general gris muy claro ────────────────────────
  doc.setFillColor(...grayLite);
  doc.rect(0, 0, W, H, 'F');

  // ════════════════════════════════════════════════════════
  // PANEL IZQUIERDO (azul) — identidad
  // ════════════════════════════════════════════════════════
  const PW = 62; // ancho panel
  doc.setFillColor(...blue);
  doc.rect(0, 0, PW, H, 'F');
  // franja inferior más oscura
  doc.setFillColor(...blueDark);
  doc.rect(0, H - 14, PW, 14, 'F');

  // Espacio para logo (recuadro redondeado claro)
  doc.setFillColor(...white);
  doc.roundedRect(14, 12, 34, 22, 3, 3, 'F');
  doc.setTextColor(...grayMid);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('tu logo', 31, 24.5, { align: 'center' });

  // Nombre clínica
  doc.setTextColor(...white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('ClínicaPro', 14, 48);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...blueSoft);
  doc.text('cuidamos tu sonrisa', 14, 53.5);

  // Palabra grande vertical-ish "CITA"
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(40);
  doc.setTextColor(255, 255, 255);
  doc.text('¡Cita!', 14, 78);

  // mini etiqueta en franja inferior
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...blueSoft);
  doc.text(`N.º ${appt.id}`, 14, H - 5);
  doc.text('TE ESPERAMOS', PW - 14, H - 5, { align: 'right' });

  // ════════════════════════════════════════════════════════
  // ÁREA DERECHA — detalles
  // ════════════════════════════════════════════════════════
  const RX = PW + 10;       // inicio contenido derecho
  const RR = W - 12;        // margen derecho

  // Saludo grande y jovial
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...gray);
  doc.text('¡Hola,', RX, 18);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...blue);
  const nombre = doc.splitTextToSize(appt.user_name + '!', RR - RX);
  doc.text(nombre[0], RX, 27);

  // Línea divisoria azul
  doc.setDrawColor(...blue);
  doc.setLineWidth(1);
  doc.line(RX, 32, RX + 22, 32);

  // ── Bloque FECHA + HORA (recuadro azul claro) ───────────
  const by = 37;
  doc.setFillColor(...blueSoft);
  doc.roundedRect(RX, by, RR - RX, 26, 3, 3, 'F');

  const fecha = new Date(appt.date + 'T00:00:00');
  const dia = fecha.toLocaleDateString('es-CO', { day: '2-digit' });
  const mes = fecha.toLocaleDateString('es-CO', { month: 'short' }).replace('.', '').toUpperCase();
  const diaSem = fecha.toLocaleDateString('es-CO', { weekday: 'long' });
  const diaSemCap = diaSem.charAt(0).toUpperCase() + diaSem.slice(1);

  // número de día enorme
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(30);
  doc.setTextColor(...blueDark);
  doc.text(dia, RX + 6, by + 19);
  // mes
  doc.setFontSize(11);
  doc.setTextColor(...blue);
  doc.text(mes, RX + 26, by + 12);
  // día de la semana
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...gray);
  doc.text(diaSemCap, RX + 26, by + 18.5);

  // separador vertical
  const sepX = RR - 42;
  doc.setDrawColor(...grayMid);
  doc.setLineWidth(0.3);
  doc.line(sepX, by + 5, sepX, by + 21);

  // hora
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...gray);
  doc.text('HORA', sepX + 6, by + 10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.setTextColor(...blueDark);
  doc.text(appt.time, sepX + 6, by + 20);

  // ── Detalles inferiores (médico / motivo) ───────────────
  let dy = 72;
  const chip = (label: string, value: string) => {
    if (!value) return;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...grayMid);
    doc.text(label.toUpperCase(), RX, dy);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(...ink);
    const lines = doc.splitTextToSize(value, RR - RX);
    doc.text(lines[0], RX, dy + 5);
    dy += 12;
  };
  chip('Tu doctor', `Dr. ${appt.doctor_name}  ·  ${appt.doctor_specialty}`);
  chip('Motivo', appt.reason || 'Consulta general');

  // nota al pie derecha
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(...grayMid);
  doc.text('Llega 10 min antes y trae este pase :)', RX, H - 6);

  // ── Descarga ────────────────────────────────────────────
  const safeName = appt.user_name.replace(/\s+/g, '_');
  doc.save(`Cita_${safeName}_${appt.date}.pdf`);
}
