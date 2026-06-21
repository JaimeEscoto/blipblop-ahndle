import { jsPDF } from 'jspdf';

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

interface Input {
  clinic: { name: string; slug: string };
  title: string;
  body: string;
  signerName: string;
  signerDocument?: string;
  signedAt: string;        // ISO
  witnessName?: string | null;
  signatureDataUrl: string; // PNG dataURL del SignaturePad
}

export async function generateConsentPDF(d: Input): Promise<Blob> {
  const W = 210, H = 297; // A4 vertical
  const doc = new jsPDF({ unit: 'mm', format: [W, H], orientation: 'portrait' });

  const navy = [15, 47, 79]   as [number, number, number];
  const ink  = [30, 41, 59]   as [number, number, number];
  const gray = [100, 116, 139] as [number, number, number];
  const white= [255, 255, 255] as [number, number, number];

  const logo = await loadImageDataUrl('/icono.png');

  // Header
  doc.setFillColor(...navy);
  doc.rect(0, 0, W, 28, 'F');
  if (logo) doc.addImage(logo, 'PNG', 12, 6, 16, 16);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...white);
  doc.text(d.clinic.name, 32, 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`odontiacloud.com/${d.clinic.slug}`, 32, 19);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('CONSENTIMIENTO INFORMADO', W - 12, 15, { align: 'right' });

  // Título
  let y = 40;
  doc.setTextColor(...ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  const titleLines = doc.splitTextToSize(d.title, W - 24);
  doc.text(titleLines, 12, y);
  y += titleLines.length * 6 + 4;

  // Cuerpo (con saltos de línea automáticos y respeto a saltos manuales)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...ink);
  const bodyLines = doc.splitTextToSize(d.body, W - 24);
  // Si excede una página, agregamos páginas adicionales
  const lineHeight = 5;
  const maxYPerPage = H - 80; // dejamos espacio para la firma
  for (const line of bodyLines) {
    if (y > maxYPerPage) {
      doc.addPage();
      y = 20;
    }
    doc.text(line, 12, y);
    y += lineHeight;
  }

  // Espacio antes de la firma
  if (y > H - 75) { doc.addPage(); y = 20; }
  y = Math.max(y + 10, H - 80);

  // Línea de firma
  doc.setDrawColor(...gray);
  doc.line(12, y, W / 2 - 6, y);
  doc.line(W / 2 + 6, y, W - 12, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...gray);
  doc.text('Firma del paciente o representante', 12, y + 4);
  doc.text('Fecha', W / 2 + 6, y + 4);

  // Imagen de firma sobre la línea
  try {
    // Cabe en un cuadro de 60x30 mm sobre la línea izquierda
    doc.addImage(d.signatureDataUrl, 'PNG', 18, y - 28, 60, 26);
  } catch { /* si falla, deja la línea vacía */ }

  // Fecha sobre la línea derecha
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...ink);
  const dateStr = new Date(d.signedAt).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' });
  doc.text(dateStr, W / 2 + 12, y - 3);

  // Datos del firmante
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...ink);
  doc.text(`Nombre: ${d.signerName}`, 12, y + 12);
  if (d.signerDocument) {
    doc.text(`Documento: ${d.signerDocument}`, 12, y + 17);
  }
  if (d.witnessName) {
    doc.setTextColor(...gray);
    doc.text(`Testigo (personal de la clínica): ${d.witnessName}`, 12, y + 23);
  }

  // Pie
  doc.setFontSize(7);
  doc.setTextColor(...gray);
  doc.text(
    `Documento generado el ${new Date().toLocaleString('es-ES')} · ${d.clinic.name}`,
    W / 2, H - 8, { align: 'center' }
  );

  return doc.output('blob');
}
