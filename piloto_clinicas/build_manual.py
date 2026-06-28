"""Genera el manual PDF del piloto OdontiaCloud."""
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib.colors import HexColor, white
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Image,
    Table, TableStyle, PageBreak, KeepTogether,
)

BRAND_DARK = HexColor("#0F4A3F")
BRAND_TEAL = HexColor("#2EA8A0")
BRAND_LIGHT = HexColor("#E6F4F1")
TEXT = HexColor("#1F2D2A")
MUTED = HexColor("#5E6E6A")
ROW_ALT = HexColor("#F5FAF8")
WARN_BG = HexColor("#FFF8E1")
WARN_BORDER = HexColor("#E0B84B")

LOGO_PATH = "/Users/maletincorp/Documents/insigne-pro/frontend/public/logo.png"
ICON_PATH = "/Users/maletincorp/Documents/insigne-pro/frontend/public/icono.png"
OUT_PATH = "/Users/maletincorp/Documents/insigne-pro/piloto_clinicas/OdontiaCloud_Manual_Piloto.pdf"

styles = getSampleStyleSheet()
BASE_FONT = "Helvetica"
BOLD_FONT = "Helvetica-Bold"

st_title = ParagraphStyle(
    "title", parent=styles["Title"], fontName=BOLD_FONT, fontSize=26,
    leading=30, textColor=BRAND_DARK, alignment=TA_LEFT, spaceAfter=4,
)
st_subtitle = ParagraphStyle(
    "subtitle", fontName=BASE_FONT, fontSize=13, leading=16,
    textColor=BRAND_TEAL, alignment=TA_LEFT, spaceAfter=18,
)
st_h1 = ParagraphStyle(
    "h1", fontName=BOLD_FONT, fontSize=16, leading=20,
    textColor=BRAND_DARK, spaceBefore=18, spaceAfter=10,
)
st_h2 = ParagraphStyle(
    "h2", fontName=BOLD_FONT, fontSize=12, leading=16,
    textColor=BRAND_TEAL, spaceBefore=10, spaceAfter=6,
)
st_body = ParagraphStyle(
    "body", fontName=BASE_FONT, fontSize=10.5, leading=15,
    textColor=TEXT, alignment=TA_JUSTIFY, spaceAfter=6,
)
st_note = ParagraphStyle(
    "note", fontName="Helvetica-Oblique", fontSize=9.5, leading=13,
    textColor=MUTED, spaceAfter=4,
)
st_li = ParagraphStyle(
    "li", parent=st_body, leftIndent=14, bulletIndent=2, spaceAfter=4,
)
st_step_n = ParagraphStyle(
    "stepn", fontName=BOLD_FONT, fontSize=22, leading=24,
    textColor=white, alignment=TA_CENTER,
)
st_step_t = ParagraphStyle(
    "stept", fontName=BOLD_FONT, fontSize=13, leading=16, textColor=BRAND_DARK,
)
st_step_d = ParagraphStyle(
    "stepd", fontName=BASE_FONT, fontSize=10.5, leading=14, textColor=TEXT,
)
st_callout = ParagraphStyle(
    "callout", fontName=BASE_FONT, fontSize=10, leading=14,
    textColor=HexColor("#6D4C00"),
)
st_footer = ParagraphStyle(
    "footer", fontName=BASE_FONT, fontSize=8.5, leading=11, textColor=MUTED,
    alignment=TA_CENTER,
)


def header_footer(canvas, doc):
    canvas.saveState()
    # Footer band
    canvas.setFillColor(BRAND_LIGHT)
    canvas.rect(0, 0, A4[0], 1.3 * cm, stroke=0, fill=1)
    canvas.setFillColor(BRAND_DARK)
    canvas.setFont(BOLD_FONT, 8.5)
    canvas.drawString(2 * cm, 0.55 * cm, "OdontiaCloud · Manual de Piloto Clínicas")
    canvas.setFillColor(MUTED)
    canvas.setFont(BASE_FONT, 8.5)
    canvas.drawRightString(A4[0] - 2 * cm, 0.55 * cm, f"Página {doc.page}")
    # Icon top-right on inner pages
    if doc.page > 1:
        try:
            canvas.drawImage(
                ICON_PATH, A4[0] - 2.6 * cm, A4[1] - 2.2 * cm,
                width=1.2 * cm, height=1.2 * cm, mask="auto",
            )
        except Exception:
            pass
    canvas.restoreState()


def bullet(text):
    return Paragraph(text, st_li, bulletText="•")


def step_block(n, title, desc):
    num_cell = Table(
        [[Paragraph(str(n), st_step_n)]],
        colWidths=[1.6 * cm], rowHeights=[1.6 * cm],
    )
    num_cell.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BRAND_TEAL),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("ROUNDEDCORNERS", [6, 6, 6, 6]),
    ]))
    body = [
        Paragraph(title, st_step_t),
        Paragraph(desc, st_step_d),
    ]
    t = Table([[num_cell, body]], colWidths=[1.9 * cm, 14.6 * cm])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
    ]))
    return t


def callout(text, label="Importante"):
    inner = [
        Paragraph(f"<b>{label}.</b> {text}", st_callout),
    ]
    t = Table([[inner]], colWidths=[16.5 * cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), WARN_BG),
        ("BOX", (0, 0), (-1, -1), 0.6, WARN_BORDER),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return t


def template_table(headers, rows):
    data = [headers] + rows
    t = Table(data, colWidths=[3.6 * cm, 2.4 * cm, 4.2 * cm, 6.3 * cm])
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), BRAND_DARK),
        ("TEXTCOLOR", (0, 0), (-1, 0), white),
        ("FONTNAME", (0, 0), (-1, 0), BOLD_FONT),
        ("FONTSIZE", (0, 0), (-1, 0), 10),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("FONTNAME", (0, 1), (-1, -1), BASE_FONT),
        ("FONTSIZE", (0, 1), (-1, -1), 9.5),
        ("TEXTCOLOR", (0, 1), (-1, -1), TEXT),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("GRID", (0, 0), (-1, -1), 0.3, HexColor("#CFD8DC")),
        ("ALIGN", (1, 1), (1, -1), "CENTER"),
    ]
    for i in range(1, len(data)):
        if i % 2 == 0:
            style.append(("BACKGROUND", (0, i), (-1, i), ROW_ALT))
    t.setStyle(TableStyle(style))
    return t


# ---------- DOC ----------
doc = BaseDocTemplate(
    OUT_PATH, pagesize=A4,
    leftMargin=2 * cm, rightMargin=2 * cm,
    topMargin=2 * cm, bottomMargin=1.8 * cm,
)
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal")
doc.addPageTemplates([PageTemplate(id="all", frames=frame, onPage=header_footer)])

story = []

# ---------- COVER ----------
logo = Image(LOGO_PATH, width=10 * cm, height=10 * cm * (540 / 3840))
logo.hAlign = "LEFT"
story.append(Spacer(1, 0.4 * cm))
story.append(logo)
story.append(Spacer(1, 1.2 * cm))
story.append(Paragraph("Manual de Piloto", st_title))
story.append(Paragraph("Carga inicial de pacientes, doctores y citas", st_subtitle))

intro = (
    "Bienvenido al piloto de <b>OdontiaCloud</b>. Este manual te guía paso a paso "
    "para preparar y enviar los datos iniciales de tu clínica: "
    "<b>pacientes</b>, <b>doctores</b> y <b>citas</b>. Todo el proceso usa una sola "
    "plantilla Excel con tres hojas, diseñada para que cualquier miembro del equipo "
    "administrativo pueda completarla sin conocimientos técnicos."
)
story.append(Paragraph(intro, st_body))
story.append(Spacer(1, 0.4 * cm))

# Summary card
summary_data = [
    [Paragraph("<b>¿Qué necesitas?</b>", st_step_t),
     Paragraph("Excel (o Google Sheets), los datos de tu clínica y unos 30 minutos.", st_body)],
    [Paragraph("<b>Archivo de plantilla</b>", st_step_t),
     Paragraph("<i>OdontiaCloud_Plantilla_Carga_Inicial.xlsx</i>", st_body)],
    [Paragraph("<b>Entregable</b>", st_step_t),
     Paragraph("La misma plantilla, llena y sin las filas de ejemplo.", st_body)],
]
tbl = Table(summary_data, colWidths=[4.5 * cm, 12 * cm])
tbl.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, -1), BRAND_LIGHT),
    ("BOX", (0, 0), (-1, -1), 0.4, BRAND_TEAL),
    ("INNERGRID", (0, 0), (-1, -1), 0.3, HexColor("#B8DDD6")),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("LEFTPADDING", (0, 0), (-1, -1), 10),
    ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ("TOPPADDING", (0, 0), (-1, -1), 8),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
]))
story.append(tbl)

story.append(PageBreak())

# ---------- PROCESO GENERAL ----------
story.append(Paragraph("Proceso general", st_h1))
story.append(Paragraph(
    "La carga inicial se realiza en cinco pasos. El orden importa: pacientes, doctores "
    "y procedimientos deben existir antes de poder vincular citas o facturar.", st_body,
))
story.append(Spacer(1, 0.3 * cm))

story.append(step_block(
    1, "Descargar la plantilla",
    "Abre el archivo <b>OdontiaCloud_Plantilla_Carga_Inicial.xlsx</b>. Verás cinco hojas: "
    "Instrucciones, Pacientes, Doctores, Procedimientos y Citas.",
))
story.append(step_block(
    2, "Llenar Pacientes y Doctores",
    "Completa primero estas dos hojas. Cada paciente y cada doctor debe tener un "
    "email único — será su identificador en el sistema.",
))
story.append(step_block(
    3, "Llenar Procedimientos",
    "Carga el catálogo de servicios que ofrece la clínica con sus precios. Es la base "
    "para cotizaciones, facturación y registro de tratamientos.",
))
story.append(step_block(
    4, "Llenar Citas",
    "Carga la agenda del próximo mes en la hoja Citas. Cada cita referencia un paciente "
    "y un doctor por email, así que ambos deben estar ya en sus hojas.",
))
story.append(step_block(
    5, "Enviar al equipo OdontiaCloud",
    "Elimina las filas en amarillo (son ejemplos) y envía el archivo. Nosotros nos "
    "encargamos de la importación y te confirmamos en menos de 24 horas.",
))

story.append(Spacer(1, 0.3 * cm))
story.append(callout(
    "Mantén el archivo en formato <b>.xlsx</b>. No cambies los nombres de las hojas ni "
    "el orden de las columnas — el importador los usa para mapear los campos.",
))

story.append(PageBreak())

# ---------- HOJA 1: PACIENTES ----------
story.append(Paragraph("Hoja 1 · Pacientes", st_h1))
story.append(Paragraph(
    "Una fila por paciente activo de la clínica. El <b>email</b> es la clave única que "
    "identifica al paciente en OdontiaCloud y en las citas.", st_body,
))
story.append(Paragraph("Campos de la plantilla", st_h2))

rows_pac = [
    ["Nombre completo", "Sí", "Texto", "Nombres y apellidos. Ej: María Fernanda López"],
    ["Email", "Sí", "Email único", "Ej: maria.lopez@gmail.com"],
    ["Teléfono", "No", "Texto", "Con indicativo. Ej: +57 320 345 6789"],
    ["Documento de identidad", "No", "Texto", "Cédula, DNI o pasaporte, sin puntos"],
    ["Tipo de sangre", "No", "Texto", "Ej: O+, A−, AB+"],
    ["Alergias", "No", "Texto", "Separadas por coma. Ej: penicilina, látex"],
    ["Condiciones médicas", "No", "Texto", "Ej: diabetes tipo 2, hipertensión"],
    ["Medicamentos actuales", "No", "Texto", "Ej: losartán 50mg, metformina 850mg"],
    ["Contacto de emergencia", "No", "Texto", "Nombre completo de la persona a contactar"],
    ["Teléfono de emergencia", "No", "Texto", "Ej: +57 311 999 0011"],
]
story.append(template_table(["Campo", "Obligatorio", "Formato", "Ejemplo / notas"], rows_pac))
story.append(Spacer(1, 0.3 * cm))
story.append(callout(
    "Si un paciente no tiene email propio, usa el de su responsable familiar y avísanos. "
    "Dos pacientes nunca pueden compartir el mismo email.",
    label="Email único",
))

story.append(PageBreak())

# ---------- HOJA 2: DOCTORES ----------
story.append(Paragraph("Hoja 2 · Doctores", st_h1))
story.append(Paragraph(
    "Una fila por profesional que atenderá en la clínica durante el piloto. El "
    "<b>email</b> será su usuario para iniciar sesión en OdontiaCloud.", st_body,
))
story.append(Paragraph("Campos de la plantilla", st_h2))

rows_doc = [
    ["Nombre completo", "Sí", "Texto", "Con título. Ej: Dr. Andrés Pardo"],
    ["Especialidad", "Sí", "Texto", "Ej: Odontología general, Ortodoncia, Endodoncia"],
    ["Email", "Sí", "Email único", "Ej: andres.pardo@clinicasonrisa.com"],
    ["Teléfono", "No", "Texto", "Ej: +57 318 111 2233"],
    ["Número de licencia / RM", "No", "Texto", "Registro odontológico. Ej: RM-OD-45821"],
]
story.append(template_table(["Campo", "Obligatorio", "Formato", "Ejemplo / notas"], rows_doc))
story.append(Spacer(1, 0.3 * cm))

story.append(Paragraph("Especialidades sugeridas", st_h2))
story.append(bullet("Odontología general"))
story.append(bullet("Ortodoncia"))
story.append(bullet("Endodoncia"))
story.append(bullet("Periodoncia"))
story.append(bullet("Cirugía oral y maxilofacial"))
story.append(bullet("Odontopediatría"))
story.append(bullet("Rehabilitación oral / prostodoncia"))

story.append(Spacer(1, 0.2 * cm))
story.append(callout(
    "Cada doctor recibirá una invitación al email indicado para crear su contraseña. "
    "Verifica que el correo esté escrito sin errores.",
    label="Invitación automática",
))

story.append(PageBreak())

# ---------- HOJA 3: PROCEDIMIENTOS ----------
story.append(Paragraph("Hoja 3 · Procedimientos", st_h1))
story.append(Paragraph(
    "Catálogo maestro de los servicios que ofrece la clínica. Cada fila es un "
    "procedimiento con su precio por defecto, lo que permite cotizar y facturar de "
    "manera consistente entre doctores.", st_body,
))
story.append(Paragraph("Campos de la plantilla", st_h2))

rows_proc = [
    ["Código", "No", "Texto", "Código interno o CUPS. Ej: D-001, 997102"],
    ["Nombre", "Sí", "Texto", "Ej: Profilaxis dental, Resina de fotocurado"],
    ["Descripción", "No", "Texto", "Detalle breve, visible al paciente"],
    ["Precio por defecto", "Sí", "Número entero", "Sin símbolos ni puntos. Ej: 80000"],
    ["Duración (minutos)", "No", "Número entero", "Tiempo estimado. Ej: 30, 45, 60"],
    ["Activo", "Sí", "Lista cerrada", "SI · NO"],
]
story.append(template_table(["Campo", "Obligatorio", "Formato", "Ejemplo / notas"], rows_proc))

story.append(Spacer(1, 0.3 * cm))
story.append(Paragraph("Sugerencias para armar el catálogo", st_h2))
story.append(bullet("Empieza por los <b>10–20 procedimientos más frecuentes</b>. Puedes agregar el resto después."))
story.append(bullet("Agrupa por familia: <b>diagnóstico, prevención, operatoria, endodoncia, exodoncia, prótesis, ortodoncia, estética</b>."))
story.append(bullet("El <b>precio por defecto</b> se puede ajustar al cobrar cada cita; este valor es solo la referencia."))
story.append(bullet("Marca como <b>Activo = NO</b> los procedimientos que ya no ofreces, en vez de borrarlos: conserva el histórico."))

story.append(Spacer(1, 0.2 * cm))
story.append(callout(
    "El precio se carga como <b>número entero sin símbolos</b>: escribe <b>80000</b>, no "
    "«$80.000» ni «80,000.00». La moneda se configura una sola vez a nivel de clínica.",
    label="Formato del precio",
))

story.append(PageBreak())

# ---------- HOJA 4: CITAS ----------
story.append(Paragraph("Hoja 4 · Citas", st_h1))
story.append(Paragraph(
    "Carga aquí la agenda del próximo mes. Cada fila es una cita que vincula a un "
    "<b>paciente</b> con un <b>doctor</b> en una fecha y hora específicas.", st_body,
))
story.append(Paragraph("Campos de la plantilla", st_h2))

rows_cit = [
    ["Email del paciente", "Sí", "Email", "Debe existir en la hoja Pacientes"],
    ["Email del doctor", "Sí", "Email", "Debe existir en la hoja Doctores"],
    ["Fecha", "Sí", "AAAA-MM-DD", "Ej: 2026-07-15"],
    ["Hora", "Sí", "HH:MM (24h)", "Ej: 09:30"],
    ["Motivo", "No", "Texto", "Ej: Control de ortodoncia, Limpieza"],
    ["Estado", "Sí", "Lista cerrada", "scheduled · completed · cancelled"],
    ["Notas", "No", "Texto", "Observaciones internas, opcional"],
]
story.append(template_table(["Campo", "Obligatorio", "Formato", "Ejemplo / notas"], rows_cit))

story.append(Spacer(1, 0.3 * cm))
story.append(Paragraph("Valores válidos para «Estado»", st_h2))
story.append(bullet("<b>scheduled</b> — cita programada y pendiente de atender (el caso más común al cargar)."))
story.append(bullet("<b>completed</b> — cita ya realizada. Úsalo si estás cargando histórico."))
story.append(bullet("<b>cancelled</b> — cita cancelada. Solo cárgala si quieres dejar registro."))

story.append(Spacer(1, 0.2 * cm))
story.append(callout(
    "La plantilla incluye una lista desplegable en la columna Estado para evitar errores "
    "de escritura.",
    label="Tip",
))

story.append(PageBreak())

# ---------- ERRORES COMUNES ----------
story.append(Paragraph("Errores comunes a evitar", st_h1))
story.append(bullet("Dejar las <b>filas de ejemplo amarillas</b> dentro del archivo enviado."))
story.append(bullet("Repetir el mismo email en dos pacientes o dos doctores."))
story.append(bullet("Escribir el email del paciente o doctor en la hoja Citas <b>sin haberlo cargado</b> antes en su hoja."))
story.append(bullet("Usar formato de fecha distinto a <b>AAAA-MM-DD</b> (no usar DD/MM/AAAA)."))
story.append(bullet("Usar formato de hora con AM/PM. Siempre <b>24h</b>, ej: 14:30."))
story.append(bullet("Escribir el <b>precio</b> de un procedimiento con símbolos o separadores (usar solo dígitos)."))
story.append(bullet("Cambiar el nombre de las hojas o reordenar las columnas."))

story.append(Spacer(1, 0.4 * cm))
story.append(Paragraph("Soporte", st_h1))
story.append(Paragraph(
    "Si tienes dudas mientras llenas la plantilla, escríbenos antes de enviarla. "
    "Preferimos resolver un email a tener que reprocesar el archivo.", st_body,
))
story.append(Spacer(1, 0.3 * cm))
contact = [
    [Paragraph("<b>Email</b>", st_step_t), Paragraph("soporte@odontiacloud.com", st_body)],
    [Paragraph("<b>Plataforma</b>", st_step_t), Paragraph("https://odontiacloud.com", st_body)],
    [Paragraph("<b>Tiempo de respuesta</b>", st_step_t), Paragraph("Confirmación de carga en menos de 24 horas hábiles.", st_body)],
]
ct = Table(contact, colWidths=[4.5 * cm, 12 * cm])
ct.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, -1), BRAND_LIGHT),
    ("BOX", (0, 0), (-1, -1), 0.4, BRAND_TEAL),
    ("INNERGRID", (0, 0), (-1, -1), 0.3, HexColor("#B8DDD6")),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("LEFTPADDING", (0, 0), (-1, -1), 10),
    ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ("TOPPADDING", (0, 0), (-1, -1), 8),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
]))
story.append(ct)

doc.build(story)
print("OK manual generado:", OUT_PATH)
