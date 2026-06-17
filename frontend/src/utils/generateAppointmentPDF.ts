import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { Appointment } from '../api/client';
import i18n from '../i18n';
import { dateLocale } from '../i18n/format';

// Carga una imagen del sitio como dataURL para incrustarla en el PDF
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

export async function generateAppointmentPDF(appt: Appointment) {
  const t = (key: string, opts?: any) => i18n.t(`pdf.${key}`, opts) as string;
  const loc = dateLocale();
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
  // Colores de marca (odontiacloud)
  const brandNavy = [15, 47, 79]   as [number, number, number];
  const brandDeep = [9, 32, 55]    as [number, number, number];

  // Logo de marca
  const logoData = await loadImageDataUrl('/icono.png');

  // ── Fondo general gris muy claro ────────────────────────
  doc.setFillColor(...grayLite);
  doc.rect(0, 0, W, H, 'F');

  // ════════════════════════════════════════════════════════
  // PANEL IZQUIERDO (azul) — identidad
  // ════════════════════════════════════════════════════════
  const PW = 62; // ancho panel
  doc.setFillColor(...brandNavy);
  doc.rect(0, 0, PW, H, 'F');
  // franja inferior más oscura
  doc.setFillColor(...brandDeep);
  doc.rect(0, H - 14, PW, 14, 'F');

  // Logo de la clínica (recuadro blanco de fondo)
  doc.setFillColor(...white);
  doc.roundedRect(11, 11, 40, 22, 3, 3, 'F');
  if (logoData) {
    // ícono cuadrado centrado en el recuadro blanco (40x22)
    const ls = 18;
    doc.addImage(logoData, 'PNG', 11 + (40 - ls) / 2, 11 + (22 - ls) / 2, ls, ls);
  } else {
    doc.setTextColor(...grayMid);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('odontiacloud', 31, 24, { align: 'center' });
  }

  // Tagline
  doc.setTextColor(...blueSoft);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(t('tagline'), 14, 44);

  // Palabra grande vertical-ish "CITA"
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(40);
  doc.setTextColor(255, 255, 255);
  doc.text(t('cita'), 14, 78);

  // Código correlativo de la cita en la franja inferior del panel
  const code = appt.public_code || `ID${appt.id}`;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...blueSoft);
  doc.text(t('appointmentCode'), PW / 2, H - 8.5, { align: 'center', charSpace: 0.8 });
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
  doc.text(t('hello'), RX, 18);
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
  const dia = fecha.toLocaleDateString(loc, { day: '2-digit' });
  const mes = fecha.toLocaleDateString(loc, { month: 'short' }).replace('.', '').toUpperCase();
  const diaSem = fecha.toLocaleDateString(loc, { weekday: 'long' });
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
  doc.text(t('hour'), sepX + 6, by + 10);
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
    doc.text(t('scanToView'), qrX + qrSize / 2, qrY + qrSize + 5, { align: 'center' });
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
  chip(t('yourDoctor'), `Dr. ${appt.doctor_name}  ·  ${appt.doctor_specialty}`);
  chip(t('reason'), appt.reason || t('generalConsult'));

  // nota al pie izquierda del área derecha
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(...grayMid);
  doc.text(t('footer'), RX, H - 6);

  // ── Descarga ────────────────────────────────────────────
  const safeName = appt.user_name.replace(/\s+/g, '_');
  doc.save(`${t('fileName')}_${safeName}_${appt.date}.pdf`);
}
