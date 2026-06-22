// Envía una visita al backend. Sin bloquear el render: usa fetch fire-and-forget
// con keepalive para que sobreviva a la navegación.
const BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';
const SESSION_KEY = 'oc_session_id';

function sessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}

const sent = new Set<string>();

export function trackVisit(path?: string) {
  try {
    const p = path || window.location.pathname + window.location.search;
    // No re-enviar la misma ruta dentro de la misma sesión de pestaña.
    if (sent.has(p)) return;
    sent.add(p);

    const url = new URL(window.location.href);
    const payload = {
      session_id: sessionId(),
      path: p,
      referrer: document.referrer || null,
      utm_source: url.searchParams.get('utm_source'),
      utm_medium: url.searchParams.get('utm_medium'),
      utm_campaign: url.searchParams.get('utm_campaign'),
      language: navigator.language,
    };

    fetch(`${BASE}/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // tracking nunca debe romper la UI
  }
}
