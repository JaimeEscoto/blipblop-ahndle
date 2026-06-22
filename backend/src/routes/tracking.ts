import { Router, Request, Response } from 'express';
import pool from '../database';

const router = Router();

// Cache en memoria de IP → geo, para no llamar a ip-api en cada hit.
const geoCache = new Map<string, GeoInfo>();
const GEO_CACHE_MAX = 5000;

type GeoInfo = {
  country: string | null;
  country_code: string | null;
  region: string | null;
  city: string | null;
};

function clientIp(req: Request): string {
  // Cloudflare / proxies comunes
  const cf = req.header('cf-connecting-ip');
  if (cf) return cf;
  const xff = req.header('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  return (req.ip || req.socket.remoteAddress || '').replace(/^::ffff:/, '');
}

function isPrivateIp(ip: string): boolean {
  if (!ip) return true;
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('localhost')) return true;
  if (/^10\./.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return true;
  if (/^fc|^fd/i.test(ip)) return true;
  return false;
}

async function lookupGeo(ip: string): Promise<GeoInfo> {
  if (!ip || isPrivateIp(ip)) {
    return { country: null, country_code: null, region: null, city: null };
  }
  const cached = geoCache.get(ip);
  if (cached) return cached;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode,regionName,city`,
      { signal: ctrl.signal }
    );
    clearTimeout(timer);
    const data: any = await res.json();
    const info: GeoInfo = data?.status === 'success'
      ? {
          country: data.country || null,
          country_code: data.countryCode || null,
          region: data.regionName || null,
          city: data.city || null,
        }
      : { country: null, country_code: null, region: null, city: null };
    if (geoCache.size >= GEO_CACHE_MAX) geoCache.clear();
    geoCache.set(ip, info);
    return info;
  } catch {
    return { country: null, country_code: null, region: null, city: null };
  }
}

// Detecta la fuente del referrer a una etiqueta amigable.
function detectSource(referrer: string | null, utmSource: string | null): string {
  const u = (utmSource || '').toLowerCase().trim();
  if (u) {
    if (u.includes('linkedin')) return 'LinkedIn';
    if (u.includes('facebook') || u === 'fb') return 'Facebook';
    if (u.includes('instagram') || u === 'ig') return 'Instagram';
    if (u.includes('twitter') || u === 'x') return 'Twitter/X';
    if (u.includes('tiktok')) return 'TikTok';
    if (u.includes('youtube')) return 'YouTube';
    if (u.includes('whatsapp')) return 'WhatsApp';
    if (u.includes('google')) return 'Google';
    if (u.includes('bing')) return 'Bing';
    if (u.includes('email') || u.includes('mail')) return 'Email';
    return utmSource!;
  }
  if (!referrer) return 'Directo';
  try {
    const host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, '');
    if (host.includes('linkedin')) return 'LinkedIn';
    if (host.includes('facebook') || host === 'fb.com' || host.includes('fb.me')) return 'Facebook';
    if (host.includes('instagram')) return 'Instagram';
    if (host.includes('twitter') || host === 'x.com' || host.includes('t.co')) return 'Twitter/X';
    if (host.includes('tiktok')) return 'TikTok';
    if (host.includes('youtube') || host === 'youtu.be') return 'YouTube';
    if (host.includes('whatsapp') || host === 'wa.me') return 'WhatsApp';
    if (host.includes('google.')) return 'Google';
    if (host.includes('bing.')) return 'Bing';
    if (host.includes('duckduckgo')) return 'DuckDuckGo';
    if (host.includes('yahoo')) return 'Yahoo';
    if (host.includes('reddit')) return 'Reddit';
    return host;
  } catch {
    return 'Otro';
  }
}

// Parser sencillo de User-Agent. Cubre los navegadores/SO mayoritarios sin
// añadir dependencias. Si en el futuro hace falta más detalle, sustituir por
// ua-parser-js.
function parseUA(ua: string): { browser: string; os: string; device: string } {
  if (!ua) return { browser: 'Desconocido', os: 'Desconocido', device: 'Desconocido' };
  const u = ua;

  let browser = 'Otro';
  if (/Edg\//i.test(u)) browser = 'Edge';
  else if (/OPR\/|Opera/i.test(u)) browser = 'Opera';
  else if (/SamsungBrowser/i.test(u)) browser = 'Samsung Internet';
  else if (/Chrome\//i.test(u) && !/Chromium/i.test(u)) browser = 'Chrome';
  else if (/Firefox\//i.test(u)) browser = 'Firefox';
  else if (/Safari\//i.test(u) && /Version\//i.test(u)) browser = 'Safari';
  else if (/MSIE |Trident\//i.test(u)) browser = 'Internet Explorer';

  let os = 'Otro';
  if (/Windows NT/i.test(u)) os = 'Windows';
  else if (/Android/i.test(u)) os = 'Android';
  else if (/(iPhone|iPad|iPod)/i.test(u)) os = 'iOS';
  else if (/Mac OS X/i.test(u)) os = 'macOS';
  else if (/CrOS/i.test(u)) os = 'ChromeOS';
  else if (/Linux/i.test(u)) os = 'Linux';

  let device = 'Desktop';
  if (/iPad|Tablet/i.test(u)) device = 'Tablet';
  else if (/Mobi|Android|iPhone|iPod/i.test(u)) device = 'Mobile';
  if (/bot|spider|crawler|slurp/i.test(u)) device = 'Bot';

  return { browser, os, device };
}

// POST público: registra una visita. No bloquea la respuesta esperando geo.
router.post('/', async (req: Request, res: Response) => {
  // Devolvemos antes de hacer el insert para no añadir latencia a la página.
  res.status(204).end();

  try {
    const body = req.body || {};
    const ua = req.header('user-agent') || '';
    const ip = clientIp(req);
    const { browser, os, device } = parseUA(ua);
    const referrer: string | null = body.referrer || null;
    const utm_source: string | null = body.utm_source || null;
    const utm_medium: string | null = body.utm_medium || null;
    const utm_campaign: string | null = body.utm_campaign || null;
    const source = detectSource(referrer, utm_source);
    const language: string | null = body.language || req.header('accept-language')?.split(',')[0] || null;

    const geo = await lookupGeo(ip);

    await pool.query(
      `INSERT INTO visits
       (session_id, path, host, referrer, referrer_source,
        utm_source, utm_medium, utm_campaign,
        ip, country, country_code, region, city,
        browser, os, device, user_agent, language)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      [
        body.session_id || null,
        body.path || null,
        req.header('host') || null,
        referrer,
        source,
        utm_source,
        utm_medium,
        utm_campaign,
        ip || null,
        geo.country,
        geo.country_code,
        geo.region,
        geo.city,
        browser,
        os,
        device,
        ua || null,
        language,
      ]
    );
  } catch (e) {
    console.warn('No se pudo registrar visita:', e);
  }
});

export default router;
