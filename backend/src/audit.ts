import { Request, Response, NextFunction } from 'express';
import pool from './database';

// Etiquetas legibles (en español) para cada módulo del sistema.
// La clave es el primer segmento de la ruta (o "modulo/subrecurso").
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

const ACTION_VERBS: Record<string, string> = {
  POST: 'Creó',
  PUT: 'Editó',
  PATCH: 'Actualizó',
  DELETE: 'Eliminó',
};

// Campos sensibles que nunca se guardan en la bitácora.
const REDACTED = ['credential', 'password', 'token', 'google_sub'];

function sanitize(body: any) {
  if (!body || typeof body !== 'object') return null;
  const clone: Record<string, any> = {};
  for (const [k, v] of Object.entries(body)) {
    if (REDACTED.includes(k)) continue;
    clone[k] = v;
  }
  return Object.keys(clone).length ? clone : null;
}

// A partir de una ruta como "/api/medical/records/5" deduce:
//   entity: "Registro clínico", entityId: "5"
function resolveEntity(path: string): { entity: string; entityId: string | null } {
  const segments = path.replace(/^\/api\//, '').split('/').filter(Boolean);
  if (!segments.length) return { entity: path, entityId: null };

  // ¿Coincide un módulo con subrecurso? p.ej. medical/records
  const twoLevel = `${segments[0]}/${segments[1] || ''}`;
  if (ENTITY_LABELS[twoLevel]) {
    return { entity: ENTITY_LABELS[twoLevel], entityId: segments[2] || null };
  }
  const label = ENTITY_LABELS[segments[0]] || segments[0];
  // El primer segmento numérico tras el módulo se toma como id.
  const entityId = segments.find((s, i) => i > 0 && /^\d+$/.test(s)) || null;
  return { entity: label, entityId };
}

interface ActivityInput {
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
}

// Inserta un evento en la bitácora. Nunca lanza: la auditoría no debe
// romper la operación principal.
export async function recordActivity(data: ActivityInput) {
  try {
    await pool.query(
      `INSERT INTO activity_log
        (account_id, account_email, account_name, action, entity, entity_id, summary, method, path, status_code, details)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
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
      ]
    );
  } catch (err) {
    console.error('No se pudo registrar la actividad:', err);
  }
}

// Middleware global: registra automáticamente toda operación que modifica
// datos (POST/PUT/PATCH/DELETE) y termina correctamente.
export function auditLog(req: Request, res: Response, next: NextFunction) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();

  // Capturamos el cuerpo de la respuesta para conocer el id de lo creado.
  const originalJson = res.json.bind(res);
  let responseBody: any;
  res.json = (body: any) => {
    responseBody = body;
    return originalJson(body);
  };

  res.on('finish', () => {
    // Solo operaciones exitosas y de usuarios autenticados.
    if (res.statusCode >= 400) return;
    if (!req.account) return;

    const { entity, entityId } = resolveEntity(req.path);
    const verb = ACTION_VERBS[req.method] || req.method;
    const id = entityId || (responseBody && responseBody.id ? String(responseBody.id) : null);
    const summary = `${verb} ${entity}${id ? ` #${id}` : ''}`;

    recordActivity({
      accountId: req.account.id,
      accountEmail: req.account.email,
      accountName: req.account.name,
      action: verb,
      entity,
      entityId: id,
      summary,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      details: sanitize(req.body),
    });
  });

  next();
}
