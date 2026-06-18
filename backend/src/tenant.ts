import { Request, Response, NextFunction } from 'express';
import pool from './database';

// Subdominios reservados: NUNCA se resuelven como una clínica
export const RESERVED_SLUGS = new Set([
  'www', 'api', 'app', 'admin', 'superadmin', 'mail', 'ftp',
  'localhost', 'staging', 'dev',
]);

export interface ClinicContext {
  id: number;
  slug: string;
  name: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      clinic?: ClinicContext;
      clinicSlug?: string;       // slug resuelto del request (aunque la clínica no exista)
      isSuperAdminHost?: boolean; // true si el host es superadmin.<dominio>
    }
  }
}

// Extrae el slug del subdominio del request. Considera:
//   1) Header X-Clinic-Slug (el frontend lo manda explícito según window.location)
//   2) Query ?clinic=  (para pruebas)
//   3) Host: <slug>.<algo>
// Devuelve null si no hay clínica (dominio raíz, www, etc.).
export function resolveSlug(req: Request): string | null {
  const hdr = (req.headers['x-clinic-slug'] as string | undefined)?.trim().toLowerCase();
  if (hdr) return RESERVED_SLUGS.has(hdr) ? null : hdr;

  const q = (req.query.clinic as string | undefined)?.trim().toLowerCase();
  if (q) return RESERVED_SLUGS.has(q) ? null : q;

  const host = (req.headers.host || '').split(':')[0].toLowerCase();
  const parts = host.split('.');
  // Host como "demo.odontiacloud.com" (3+) o "demo.localhost" (2)
  if (parts.length >= 3 || (parts.length === 2 && parts[1] === 'localhost')) {
    const slug = parts[0];
    if (RESERVED_SLUGS.has(slug)) return null;
    return slug;
  }
  return null;
}

export function isSuperAdminHost(req: Request): boolean {
  const hdr = (req.headers['x-clinic-slug'] as string | undefined)?.trim().toLowerCase();
  if (hdr === 'superadmin') return true;
  const q = (req.query.clinic as string | undefined)?.trim().toLowerCase();
  if (q === 'superadmin') return true;
  const host = (req.headers.host || '').split(':')[0].toLowerCase();
  return host.split('.')[0] === 'superadmin';
}

// Middleware: resuelve la clínica del request y la adjunta a req.clinic.
// Si no encuentra clínica, responde 404. Úsalo en rutas que SIEMPRE
// pertenezcan a una clínica.
export async function requireClinic(req: Request, res: Response, next: NextFunction) {
  const slug = resolveSlug(req);
  req.clinicSlug = slug || undefined;
  req.isSuperAdminHost = isSuperAdminHost(req);
  if (!slug) return res.status(404).json({ error: 'Clínica no especificada' });

  const { rows } = await pool.query(
    'SELECT id, slug, name FROM clinics WHERE slug = $1',
    [slug]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Clínica no encontrada' });
  req.clinic = rows[0];
  next();
}

// Variante suave: resuelve si puede, pero no falla si no encuentra.
// Útil en /api/auth/me o endpoints públicos.
export async function attachClinic(req: Request, _res: Response, next: NextFunction) {
  const slug = resolveSlug(req);
  req.clinicSlug = slug || undefined;
  req.isSuperAdminHost = isSuperAdminHost(req);
  if (slug) {
    const { rows } = await pool.query('SELECT id, slug, name FROM clinics WHERE slug = $1', [slug]);
    if (rows[0]) req.clinic = rows[0];
  }
  next();
}
