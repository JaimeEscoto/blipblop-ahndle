// Detecta el modo de la app según el subdominio actual.
//
//   odontiacloud.com           → 'root'      (landing + crear clínica)
//   superadmin.odontiacloud.com → 'superadmin' (portal del super admin)
//   <algo>.odontiacloud.com    → 'clinic'    (sistema de esa clínica)
//
// En desarrollo:
//   localhost                  → 'root'
//   superadmin.localhost       → 'superadmin'
//   <algo>.localhost           → 'clinic'
//   ?clinic=<slug>             → fuerza 'clinic' con ese slug (útil para previews)
//   ?clinic=superadmin         → fuerza 'superadmin'

const RESERVED = new Set([
  'www', 'api', 'app', 'admin', 'mail', 'ftp', 'staging', 'dev',
]);

export type TenantMode = 'root' | 'clinic' | 'superadmin';

function fromQuery(): string | null {
  const p = new URLSearchParams(window.location.search);
  const v = (p.get('clinic') || '').trim().toLowerCase();
  return v || null;
}

function fromHost(): string | null {
  const host = window.location.hostname.toLowerCase();
  const parts = host.split('.');
  // 'localhost' a secas → null (modo root)
  if (host === 'localhost') return null;
  // 'demo.localhost' → 'demo' ; 'demo.odontiacloud.com' → 'demo'
  if (parts.length >= 3 || (parts.length === 2 && parts[1] === 'localhost')) {
    return parts[0];
  }
  return null;
}

export function currentSlug(): string | null {
  const slug = fromQuery() || fromHost();
  if (!slug) return null;
  if (RESERVED.has(slug)) return null;
  return slug;
}

export function currentMode(): TenantMode {
  const slug = fromQuery() || fromHost();
  if (!slug) return 'root';
  if (slug === 'superadmin') return 'superadmin';
  if (RESERVED.has(slug)) return 'root';
  return 'clinic';
}

// Construye la URL del subdominio de una clínica (para redirigir tras crearla).
export function clinicUrl(slug: string): string {
  const host = window.location.hostname;
  if (host === 'localhost' || host.endsWith('.localhost')) {
    return `${window.location.protocol}//${slug}.localhost:${window.location.port || '5173'}`;
  }
  // Producción: reemplaza el primer segmento (o agrega) del host actual
  const parts = host.split('.');
  const apex = parts.length >= 2 ? parts.slice(-2).join('.') : host;
  return `${window.location.protocol}//${slug}.${apex}`;
}
