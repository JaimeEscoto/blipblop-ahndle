import { jsPDF } from 'jspdf';
import { Appointment } from '../api/client';

export function generateAppointmentPDF(appt: Appointment) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = 210;
  const margin = 20;
  const contentW = pageW - margin * 2;

  // ── Colors ──────────────────────────────────────────────
  const blue  = [37, 99, 235]  as [number,number,number];
  const gray  = [107,114,128]  as [number,number,number];
  const light = [243,244,246]  as [number,number,number];
  const dark  = [17, 24, 39]   as [number,number,number];
  const white = [255,255,255]  as [number,number,number];
  const green = [22, 163, 74]  as [number,number,number];

  // ── Header bar ──────────────────────────────────────────
  doc.setFillColor(...blue);
  doc.rect(0, 0, pageW, 45, 'F');

  // Logo placeholder box
  doc.setFillColor(...white);
  doc.setDrawColor(...white);
  doc.roundedRect(margin, 8, 40, 28, 3, 3, 'FD');
  doc.setTextColor(...blue);
  doc.setFontSize(7);
  doc.text('[ Logo de la clínica ]', margin + 20, 24, { align: 'center' });

  // Clinic name area
  doc.setTextColor(...white);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Confirmación de Cita', margin + 48, 22);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Documento generado automáticamente por ClínicaPro', margin + 48, 30);

  // ── Status badge ────────────────────────────────────────
  const statusLabels: Record<string, string> = {
    scheduled: 'PROGRAMADA', completed: 'COMPLETADA', cancelled: 'CANCELADA'
  };
  const statusColors: Record<string, [number,number,number]> = {
    scheduled: blue, completed: green, cancelled: [220,38,38]
  };
  const badgeColor = statusColors[appt.status] || blue;
  doc.setFillColor(...badgeColor);
  doc.roundedRect(pageW - margin - 38, 10, 38, 10, 2, 2, 'F');
  doc.setTextColor(...white);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text(statusLabels[appt.status] || appt.status.toUpperCase(), pageW - margin - 19, 17, { align: 'center' });

  let y = 60;

  // ── Section helper ──────────────────────────────────────
  const section = (title: string) => {
    doc.setFillColor(...light);
    doc.rect(margin, y, contentW, 8, 'F');
    doc.setTextColor(...blue);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(title.toUpperCase(), margin + 4, y + 5.5);
    y += 12;
  };

  const row = (label: string, value: string, fullWidth = false) => {
    if (!value) return;
    const col = fullWidth ? contentW : contentW / 2;
    doc.setTextColor(...gray);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(label, margin + 2, y);
    doc.setTextColor(...dark);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    const lines = doc.splitTextToSize(value, col - 4);
    doc.text(lines, margin + 2, y + 5);
    y += 6 + (lines.length - 1) * 4;
  };

  const twoCol = (l1: string, v1: string, l2: string, v2: string) => {
    const half = contentW / 2;
    doc.setTextColor(...gray);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(l1, margin + 2, y);
    doc.text(l2, margin + half + 2, y);
    doc.setTextColor(...dark);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(v1, margin + 2, y + 5);
    doc.text(v2, margin + half + 2, y + 5);
    y += 13;
  };

  // ── Fecha y Hora (destacado) ─────────────────────────────
  doc.setFillColor(...blue);
  doc.roundedRect(margin, y, contentW, 22, 3, 3, 'F');
  const dateFormatted = new Date(appt.date + 'T00:00:00').toLocaleDateString('es-CO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  const dateCap = dateFormatted.charAt(0).toUpperCase() + dateFormatted.slice(1);
  doc.setTextColor(...white);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(dateCap, pageW / 2, y + 9, { align: 'center' });
  doc.setFontSize(11);
  doc.text(`Hora: ${appt.time}`, pageW / 2, y + 17, { align: 'center' });
  y += 28;

  // ── Información del paciente ─────────────────────────────
  section('Información del paciente');
  row('Nombre completo', appt.user_name, true);
  twoCol('Correo electrónico', appt.user_email, 'Teléfono', appt.user_phone || 'No registrado');

  // ── Información del médico ───────────────────────────────
  section('Médico tratante');
  twoCol('Nombre', `Dr. ${appt.doctor_name}`, 'Especialidad', appt.doctor_specialty);

  // ── Detalles de la cita ──────────────────────────────────
  section('Detalles de la cita');
  if (appt.reason) row('Motivo de la consulta', appt.reason, true);
  if (appt.notes)  row('Notas adicionales', appt.notes, true);
  if (!appt.reason && !appt.notes) {
    doc.setTextColor(...gray);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text('Sin detalles adicionales registrados.', margin + 2, y);
    y += 10;
  }

  // ── Instrucciones ────────────────────────────────────────
  y += 4;
  section('Instrucciones para el paciente');
  const instrucciones = [
    '• Por favor llegue 10 minutos antes de su cita.',
    '• Traiga este documento el día de su cita.',
    '• Si necesita cancelar o reprogramar, comuníquese con anticipación.',
    '• Traiga su documento de identidad.',
  ];
  doc.setTextColor(...dark);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  instrucciones.forEach(inst => {
    doc.text(inst, margin + 2, y);
    y += 6;
  });

  // ── Footer ───────────────────────────────────────────────
  const footerY = 272;
  doc.setDrawColor(...light);
  doc.line(margin, footerY, pageW - margin, footerY);
  doc.setTextColor(...gray);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Cita #${appt.id} · Generado el ${new Date().toLocaleDateString('es-CO')} · ClínicaPro`,
    pageW / 2, footerY + 6, { align: 'center' }
  );

  // ── Download ─────────────────────────────────────────────
  const safeName = appt.user_name.replace(/\s+/g, '_');
  doc.save(`Cita_${safeName}_${appt.date}.pdf`);
}
