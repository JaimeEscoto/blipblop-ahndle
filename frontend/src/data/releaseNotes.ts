// Novedades del sistema.
//
// El WhatsNewModal muestra al usuario todas las entradas con `id` mayor que el
// último id que ya vio (guardado en localStorage). Al agregar una nueva
// funcionalidad, añade una entrada al FINAL con el siguiente id — no reutilices
// ni reordenes los ids anteriores.
//
// - id:    entero incremental, único por entrada.
// - date:  fecha de publicación (YYYY-MM-DD), para ordenar y mostrar.
// - icon:  emoji corto — se muestra a la izquierda del título en el modal.
// - title: título en 6-8 palabras.
// - body:  descripción en 1-3 frases. Puede ir en HTML plano (etiquetas <b>,
//          <br>, <a>) — se renderiza vía dangerouslySetInnerHTML.

export interface ReleaseNote {
  id: number;
  date: string;
  icon: string;
  title: string;
  body: string;
}

export const RELEASE_NOTES: readonly ReleaseNote[] = [
  {
    id: 1,
    date: '2026-06-27',
    icon: '📋',
    title: 'Piloto de clínicas: plantilla de carga inicial',
    body: 'Nueva plantilla Excel con hojas para pacientes, doctores, procedimientos y citas. Manual PDF con logo de OdontiaCloud incluido. Todo listo para arrancar una clínica desde cero.',
  },
  {
    id: 2,
    date: '2026-06-27',
    icon: '💊',
    title: 'Venta de insumos separada de citas',
    body: 'Ahora puedes emitir facturas sin cita para vender insumos o productos. En Finanzas, botón <b>Insumos</b> al lado de Nueva factura. Las facturas de cita siguen exigiendo cita — todo queda bien separado.',
  },
  {
    id: 3,
    date: '2026-06-28',
    icon: '📝',
    title: 'Facturas en borrador, editables antes de emitir',
    body: 'Al cerrar una cita con procedimientos, la factura se crea en <b>borrador</b>. Puedes ajustar items, IVA, descuento o agregar insumos extra, y solo entonces pulsar <b>Emitir factura</b> para empezar a cobrar.',
  },
  {
    id: 4,
    date: '2026-06-28',
    icon: '🦷',
    title: 'Planes de tratamiento multi-sesión',
    body: 'Para procedimientos como ortodoncia o endodoncia. Configura sesiones por defecto en el catálogo. Al crear el plan pones total y sesiones, se calcula el precio por sesión y se propone la agenda. Cada sesión al completarse genera su propia factura draft. En el expediente del paciente, pestaña <b>Tratamientos</b>.',
  },
  {
    id: 5,
    date: '2026-06-28',
    icon: '🧪',
    title: 'Modo demostración con link público',
    body: 'Una clínica marcada como demo se puede compartir con un link especial. Los visitantes introducen su nombre y entran a un sandbox compartido con datos reales. Botón para resetear los datos siempre a la vista.',
  },
  {
    id: 6,
    date: '2026-07-25',
    icon: '🌎',
    title: 'Pacientes de varios países',
    body: 'Ahora al crear un paciente puedes elegir su país (Honduras, Nicaragua, Guatemala, El Salvador, Costa Rica) y el departamento/provincia se filtra automáticamente. Configura el país por defecto de tu clínica en <b>Ajustes → Finanzas</b>.',
  },
];

/** El id más alto disponible (para comparar contra lo que el usuario ya vio). */
export const LATEST_RELEASE_NOTE_ID: number =
  RELEASE_NOTES.reduce((max, n) => (n.id > max ? n.id : max), 0);
