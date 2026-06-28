// Detecta la clínica a partir del PRIMER segmento del path.
//
//   odontiacloud.com/             → 'root'       (landing + crear clínica)
//   odontiacloud.com/crear-clinica/ → 'root'     (formulario para crear clínica)
//   odontiacloud.com/superadmin/  → 'superadmin' (portal del super admin)
//   odontiacloud.com/cita/:code   → 'root'       (vista pública del paciente)
//   odontiacloud.com/<slug>/...   → 'clinic'     (sistema de esa clínica)
//
// Mantenemos también soporte de ?clinic=<slug> como atajo (testing/previews).

const RESERVED = new Set([
  // Rutas top-level del sistema (no pueden ser slugs de clínica)
  'crear-clinica', 'superadmin', 'cita', 'crear-cuenta', 'login', 'demo',
  // Nombres reservados por convención (futuras rutas/servicios)
  'www', 'api', 'app', 'admin', 'mail', 'ftp', 'staging', 'dev',
]);

export type TenantMode = 'root' | 'clinic' | 'superadmin';

function firstPathSegment(): string | null {
  const parts = window.location.pathname.split('/').filter(Boolean);
  const first = parts[0]?.toLowerCase();
  return first || null;
}

function fromQuery(): string | null {
  const p = new URLSearchParams(window.location.search);
  return (p.get('clinic') || '').trim().toLowerCase() || null;
}

export function currentMode(): TenantMode {
  const first = fromQuery() || firstPathSegment();
  if (first === 'superadmin') return 'superadmin';
  if (!first || RESERVED.has(first)) return 'root';
  return 'clinic';
}

export function currentSlug(): string | null {
  const first = fromQuery() || firstPathSegment();
  if (!first || RESERVED.has(first)) return null;
  return first;
}

// URL que se abre tras crear la clínica.
export function clinicUrl(slug: string): string {
  return `${window.location.origin}/${slug}/`;
}

// Antepone el slug a una ruta interna de la clínica (ej. '/inicio' → '/demo/inicio').
// Se usa para los NavLinks del menú y redirecciones.
export function withSlug(path: string): string {
  const slug = currentSlug();
  const clean = path.startsWith('/') ? path : `/${path}`;
  return slug ? `/${slug}${clean}` : clean;
}
