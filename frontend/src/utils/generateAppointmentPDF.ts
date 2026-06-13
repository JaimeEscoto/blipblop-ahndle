import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { Appointment } from '../api/client';

export async function generateAppointmentPDF(appt: Appointment) {
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

  // Código correlativo de la cita en la franja inferior del panel
  const code = appt.public_code || `ID${appt.id}`;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...blueSoft);
  doc.text('CÓDIGO DE CITA', PW / 2, H - 8.5, { align: 'center', charSpace: 0.8 });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...white);
  doc.text(code, PW / 2, H - 3, { align: 'center', charSpace: 1 });

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

  // ── QR de la invitación (esquina inferior derecha) ──────
  const qrSize = 28;
  const qrX = RR - qrSize;
  const qrY = 70;
  const base = (typeof window !== 'undefined' && window.location?.origin)
    ? window.location.origin
    : 'https://blipblop-ahndle-1-fe.onrender.com';
  const inviteUrl = `${base}/cita/${code}`;
  try {
    const qrDataUrl = await QRCode.toDataURL(inviteUrl, {
      margin: 1,
      width: 280,
      color: { dark: '#1d3a8a', light: '#ffffff' },
    });
    // marco blanco para que el QR contraste sobre el fondo gris
    doc.setFillColor(...white);
    doc.roundedRect(qrX - 2, qrY - 2, qrSize + 4, qrSize + 4, 2, 2, 'F');
    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...blue);
    doc.text('Escanea para ver tu cita', qrX + qrSize / 2, qrY + qrSize + 5, { align: 'center' });
  } catch {
    // si el QR falla, el PDF se genera igual sin él
  }

  // ── Detalles inferiores (médico / motivo) ───────────────
  // se limita el ancho para no invadir el QR
  const textW = qrX - 6 - RX;
  let dy = 74;
  const chip = (label: string, value: string) => {
    if (!value) return;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...grayMid);
    doc.text(label.toUpperCase(), RX, dy);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...ink);
    const lines = doc.splitTextToSize(value, textW);
    doc.text(lines.slice(0, 2), RX, dy + 5);
    dy += 6 + Math.min(lines.length, 2) * 5;
  };
  chip('Tu doctor', `Dr. ${appt.doctor_name}  ·  ${appt.doctor_specialty}`);
  chip('Motivo', appt.reason || 'Consulta general');

  // nota al pie izquierda del área derecha
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(...grayMid);
  doc.text('Llega 10 min antes y trae este pase :)', RX, H - 6);

  // ── Descarga ────────────────────────────────────────────
  const safeName = appt.user_name.replace(/\s+/g, '_');
  doc.save(`Cita_${safeName}_${appt.date}.pdf`);
}
