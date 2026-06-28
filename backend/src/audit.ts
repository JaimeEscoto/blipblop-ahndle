import { Request, Response, NextFunction } from 'express';
import pool from './database';

// Etiquetas legibles (en español) de cada módulo. Se usan para filtrar.
const ENTITY_LABELS: Record<string, string> = {
  users: 'Paciente',
  doctors: 'Médico',
  appointments: 'Cita',
  inventory: 'Inventario',
  reminders: 'Recordatorio',
  invitations: 'Invitación',
  'medical/records': 'Registro clínico',
  'medical/info': 'Información médica',
};

// Campos sensibles que nunca se guardan en la bitácora.
const REDACTED = ['credential', 'password', 'token', 'google_sub'];
// Campos internos sin valor para el lector (ids técnicos, marcas de tiempo).
const NOISE = ['id', 'created_at', 'updated_at', 'public_code', 'accepted_at', 'last_login'];

function sanitize(body: any) {
  if (!body || typeof body !== 'object') return null;
  const clone: Record<string, any> = {};
  for (const [k, v] of Object.entries(body)) {
    if (REDACTED.includes(k) || NOISE.includes(k)) continue;
    clone[k] = v;
  }
  return Object.keys(clone).length ? clone : null;
}

const isBlank = (v: any) => v === null || v === undefined || v === '';

// Compara dos valores tolerando null/'' y objetos (JSON).
function sameValue(a: any, b: any): boolean {
  if (isBlank(a) && isBlank(b)) return true;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return String(a) === String(b);
}

// Diferencia campo a campo entre el estado anterior y el posterior.
// Devuelve { campo: { from, to } } solo con lo que realmente cambió.
function diffRecord(before: any, after: any) {
  if (!before || typeof before !== 'object' || !after || typeof after !== 'object') return null;
  const changes: Record<string, { from: any; to: any }> = {};
  for (const k of Object.keys(before)) {
    if (REDACTED.includes(k) || NOISE.includes(k)) continue;
    if (!(k in after)) continue; // campo no devuelto por la respuesta
    if (!sameValue(before[k], after[k])) {
      changes[k] = { from: isBlank(before[k]) ? null : before[k], to: isBlank(after[k]) ? null : after[k] };
    }
  }
  return Object.keys(changes).length ? changes : null;
}

// Decide qué guardar en la columna `details` según la operación.
function buildDetails(req: Request, responseBody: any) {
  // DELETE: el cuerpo de la petición viene vacío; el detalle de lo que se
  // borró está en el registro devuelto por la respuesta.
  if (req.method === 'DELETE') return sanitize(responseBody);
  // Edición con estado previo capturado: mostramos qué campos cambiaron.
  if (req.auditBefore) {
    const changes = diffRecord(req.auditBefore, responseBody);
    if (changes) return changes;
  }
  // Creación (o edición sin estado previo): los valores enviados.
  return sanitize(req.body);
}

const STATUS_ES: Record<string, string> = {
  cancelled: 'cancelada', completed: 'completada', scheduled: 'programada',
  done: 'completado', pending: 'pendiente',
};

interface BuiltEntry {
  action: string;
  entity: string;
  entityId: string | null;
  summary: string;
}

// Construye una descripción legible de la operación. Devuelve null cuando
// la operación no debe registrarse (p.ej. GET de listados o sondeos).
function buildEntry(
  method: string,
  originalUrl: string,
  body: any,
  resp: any
): BuiltEntry | null {
  const seg = originalUrl.split('?')[0].replace(/^\/api\//, '').split('/').filter(Boolean);
  const [mod, a, b] = seg;
  const r = resp && typeof resp === 'object' ? resp : {};
  // id del recurso: el de la URL, o el del objeto devuelto.
  const urlId = [a, b].find(s => /^\d+$/.test(s || '')) || null;
  const id = urlId || (r.id != null ? String(r.id) : null);
  const tag = (label: string) => (id ? `${label} #${id}` : label);

  // --- Consultas (GET): solo las sensibles, nunca los listados ---
  if (method === 'GET') {
    if (mod === 'medical' && a === 'records' && b) {
      return { action: 'Consultó', entity: 'Registro clínico', entityId: b, summary: `Consultó el expediente del paciente #${b}` };
    }
    if (mod === 'medical' && a === 'info' && b) {
      return { action: 'Consultó', entity: 'Información médica', entityId: b, summary: `Consultó la información médica del paciente #${b}` };
    }
    return null; // listados y sondeos no se registran
  }

  switch (mod) {
    case 'appointments': {
      const who = r.user_name ? ` de ${r.user_name}` : '';
      const withDoc = r.doctor_name ? ` con ${r.doctor_name}` : '';
      const when = r.date ? ` el ${r.date}${r.time ? ` a las ${r.time}` : ''}` : '';
      if (method === 'POST') return { action: 'Creó', entity: 'Cita', entityId: id, summary: `Agendó una cita${who}${withDoc}${when}` };
      if (method === 'DELETE') return { action: 'Eliminó', entity: 'Cita', entityId: id, summary: (who || withDoc || when) ? `Eliminó la cita${who}${withDoc}${when}` : tag('Eliminó la cita') };
      if (a && b === 'status') {
        const est = STATUS_ES[body?.status] || body?.status || '';
        const verb = body?.status === 'cancelled' ? 'Canceló' : body?.status === 'completed' ? 'Completó' : 'Reactivó';
        return { action: 'Editó', entity: 'Cita', entityId: id, summary: `${verb} la cita${who}${withDoc} (ahora ${est})` };
      }
      return { action: 'Editó', entity: 'Cita', entityId: id, summary: tag(`Editó la cita${who}`) };
    }
    case 'users': {
      const name = r.name ? ` ${r.name}` : '';
      if (method === 'POST') return { action: 'Creó', entity: 'Paciente', entityId: id, summary: `Registró al paciente${name}` };
      if (method === 'DELETE') return { action: 'Eliminó', entity: 'Paciente', entityId: id, summary: name ? tag(`Eliminó al paciente${name}`) : tag('Eliminó al paciente') };
      return { action: 'Editó', entity: 'Paciente', entityId: id, summary: name ? tag(`Editó los datos de${name}`) : tag('Editó un paciente') };
    }
    case 'doctors': {
      const name = r.name ? ` ${r.name}` : '';
      const spec = r.specialty ? ` (${r.specialty})` : '';
      if (method === 'POST') return { action: 'Creó', entity: 'Médico', entityId: id, summary: `Agregó al médico${name}${spec}` };
      if (method === 'DELETE') return { action: 'Eliminó', entity: 'Médico', entityId: id, summary: name ? tag(`Eliminó al médico${name}${spec}`) : tag('Eliminó un médico') };
      return { action: 'Editó', entity: 'Médico', entityId: id, summary: name ? tag(`Editó al médico${name}`) : tag('Editó un médico') };
    }
    case 'inventory': {
      const name = r.name ? ` "${r.name}"` : '';
      if (method === 'POST') return { action: 'Creó', entity: 'Inventario', entityId: id, summary: `Agregó al inventario${name}` };
      if (method === 'DELETE') return { action: 'Eliminó', entity: 'Inventario', entityId: id, summary: name ? `Eliminó del inventario${name}` : tag('Eliminó un producto del inventario') };
      if (b === 'quantity') return { action: 'Editó', entity: 'Inventario', entityId: id, summary: `Ajustó la existencia de${name || ' un producto'} a ${r.quantity ?? body?.quantity} ${r.unit ?? ''}`.trim() };
      return { action: 'Editó', entity: 'Inventario', entityId: id, summary: name ? `Editó el producto${name}` : tag('Editó un producto') };
    }
    case 'reminders': {
      const title = r.title ? ` "${r.title}"` : '';
      if (method === 'POST') return { action: 'Creó', entity: 'Recordatorio', entityId: id, summary: `Creó el recordatorio${title}` };
      if (method === 'DELETE') return { action: 'Eliminó', entity: 'Recordatorio', entityId: id, summary: title ? `Eliminó el recordatorio${title}` : tag('Eliminó un recordatorio') };
      if (b === 'status') {
        const verb = (r.status ?? body?.status) === 'done' ? 'Completó' : 'Reabrió';
        return { action: 'Editó', entity: 'Recordatorio', entityId: id, summary: `${verb} el recordatorio${title}` };
      }
      return { action: 'Editó', entity: 'Recordatorio', entityId: id, summary: tag('Editó un recordatorio') };
    }
    case 'invitations': {
      if (method === 'POST') return { action: 'Creó', entity: 'Invitación', entityId: id, summary: `Invitó a ${r.email || body?.email || 'un usuario'}` };
      if (method === 'DELETE') return { action: 'Eliminó', entity: 'Invitación', entityId: id, summary: (r.email || body?.email) ? `Eliminó la invitación de ${r.email || body?.email}` : tag('Eliminó una invitación') };
      return { action: 'Editó', entity: 'Invitación', entityId: id, summary: tag('Modificó una invitación') };
    }
    case 'medical': {
      if (a === 'info') {
        return { action: 'Editó', entity: 'Información médica', entityId: b || id, summary: `Actualizó la información médica del paciente${b ? ` #${b}` : ''}` };
      }
      // records
      const dx = body?.diagnosis ? `: ${body.diagnosis}` : '';
      if (method === 'POST') return { action: 'Creó', entity: 'Registro clínico', entityId: id, summary: `Registró una atención clínica${dx}` };
      if (method === 'DELETE') return { action: 'Eliminó', entity: 'Registro clínico', entityId: id, summary: tag('Eliminó un registro clínico') };
      return { action: 'Editó', entity: 'Registro clínico', entityId: id, summary: tag('Editó un registro clínico') };
    }
    default: {
      const verb = method === 'POST' ? 'Creó' : method === 'DELETE' ? 'Eliminó' : 'Actualizó';
      return { action: verb, entity: mod || originalUrl, entityId: id, summary: tag(`${verb} ${mod || ''}`.trim()) };
    }
  }
}

interface ActivityInput {
  clinicId?: number | null;
  accountId?: number | null;
  accountEmail?: string | null;
  accountName?: string | null;
  action: string;
  entity?: string | null;
  entityId?: string | null;
  summary: string;
  method?: string | null;
  path?: string | null;
  statusCode?: number | null;
  details?: any;
  internal?: boolean; // true → acción del super admin oculta para la clínica
}

// Inserta un evento en la bitácora. Nunca lanza: la auditoría no debe
// romper la operación principal.
export async function recordActivity(data: ActivityInput) {
  try {
    await pool.query(
      `INSERT INTO activity_log
        (clinic_id, account_id, account_email, account_name, action, entity, entity_id, summary, method, path, status_code, details, internal)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        data.clinicId ?? null,
        data.accountId ?? null,
        data.accountEmail ?? null,
        data.accountName ?? null,
        data.action,
        data.entity ?? null,
        data.entityId ?? null,
        data.summary,
        data.method ?? null,
        data.path ?? null,
        data.statusCode ?? null,
        data.details ? JSON.stringify(data.details) : null,
        data.internal === true,
      ]
    );
  } catch (err) {
    console.error('No se pudo registrar la actividad:', err);
  }
}

// Middleware global: registra automáticamente lo que hace cada usuario.
// Operaciones que modifican datos (POST/PUT/PATCH/DELETE) y consultas
// sensibles (abrir un expediente / la información médica de un paciente).
export function auditLog(req: Request, res: Response, next: NextFunction) {
  const tracked = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  if (!tracked) return next();

  // Capturamos el cuerpo de la respuesta para conocer nombres e ids reales.
  const originalJson = res.json.bind(res);
  let responseBody: any;
  res.json = (body: any) => {
    responseBody = body;
    return originalJson(body);
  };

  res.on('finish', () => {
    if (res.statusCode >= 400) return;        // solo operaciones exitosas
    if (!req.account) return;                  // solo usuarios autenticados

    const entry = buildEntry(req.method, req.originalUrl, req.body, responseBody);
    if (!entry) return;                        // listados/sondeos: no se registran

    // Visitante demo no tiene fila en accounts → accountId queda NULL pero
    // se preserva su nombre para que el dueño de la clínica pueda ver quién hizo qué.
    const accountId = req.account.is_demo_visitor ? null : req.account.id;
    recordActivity({
      clinicId: req.account.clinic_id,
      accountId,
      accountEmail: req.account.email,
      accountName: req.account.name,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      summary: entry.summary,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      details: buildDetails(req, responseBody),
      internal: req.account.is_shadow === true,
    });
  });

  next();
}
