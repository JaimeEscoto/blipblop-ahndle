import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { clinicUrl } from '../tenant';
import { CheckCircle, AlertCircle, ArrowRight, X } from 'lucide-react';
import { trackVisit } from '../utils/track';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

declare global { interface Window { google?: any; } }

type Step = 'auth' | 'form' | 'done';
type SlugStatus = 'idle' | 'checking' | 'ok' | 'taken' | 'invalid';

export default function CreateClinic() {
  const btnRef = useRef<HTMLDivElement>(null);
  const [credential, setCredential] = useState('');
  const [googleEmail, setGoogleEmail] = useState('');
  const [step, setStep] = useState<Step>('auth');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<{ slug: string; name: string } | null>(null);
  const [terms, setTerms] = useState<{ id: number; version: string; content: string } | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  useEffect(() => { trackVisit('/crear-clinica'); }, []);

  // Carga la versión vigente de los términos al entrar al paso de formulario.
  useEffect(() => {
    if (step !== 'form' || terms) return;
    api.terms.current()
      .then(t => setTerms({ id: t.id, version: t.version, content: t.content }))
      .catch(() => setError('No se pudieron cargar los Términos de Servicio. Recarga la página.'));
  }, [step, terms]);

  // Init Google Identity Services en el paso de auth
  useEffect(() => {
    if (step !== 'auth') return;
    if (!CLIENT_ID) { setError('Falta configurar VITE_GOOGLE_CLIENT_ID.'); return; }

    const handle = (resp: any) => {
      setCredential(resp.credential);
      // Lee el correo del JWT para mostrarlo (sin verificar firma — solo UI)
      try {
        const payload = JSON.parse(atob(resp.credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        setGoogleEmail(payload.email || '');
      } catch { /* noop */ }
      setStep('form');
    };

    const init = () => {
      if (!window.google) return;
      window.google.accounts.id.initialize({ client_id: CLIENT_ID, callback: handle });
      if (btnRef.current) {
        btnRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(btnRef.current, { theme: 'outline', size: 'large', text: 'continue_with', shape: 'pill', width: 280 });
      }
    };

    if (window.google) { init(); return; }
    const existing = document.getElementById('gsi-script');
    if (existing) { existing.addEventListener('load', init); return; }
    const s = document.createElement('script');
    s.id = 'gsi-script'; s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.defer = true; s.onload = init;
    document.body.appendChild(s);
  }, [step]);

  // Verificación en vivo del slug (con pequeño debounce)
  useEffect(() => {
    if (!slug) { setSlugStatus('idle'); return; }
    setSlugStatus('checking');
    const t = setTimeout(async () => {
      try {
        const r = await api.clinics.checkSlug(slug);
        if (r.available) setSlugStatus('ok');
        else setSlugStatus(r.reason === 'invalid' ? 'invalid' : 'taken');
      } catch { setSlugStatus('idle'); }
    }, 350);
    return () => clearTimeout(t);
  }, [slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!credential) { setError('Vuelve a iniciar sesión con Google.'); setStep('auth'); return; }
    if (!name.trim()) { setError('Falta el nombre de la clínica.'); return; }
    if (slugStatus !== 'ok') { setError('Elige un subdominio válido y disponible.'); return; }
    if (!terms) { setError('Aún cargando los Términos de Servicio…'); return; }
    if (!acceptedTerms) { setError('Debes aceptar los Términos de Servicio para crear la clínica.'); return; }
    setSubmitting(true);
    try {
      const r = await api.clinics.create(credential, slug.trim().toLowerCase(), name.trim(), terms.id);
      // Guardamos el token y la cuenta para que el dueño quede ya con sesión iniciada
      // cuando llegue a su subdominio (se almacena bajo el mismo localStorage, que NO
      // se comparte entre subdominios, pero al menos queda el feedback de éxito).
      setCreated({ slug: r.clinic.slug, name: r.clinic.name });
      setStep('done');
    } catch (err: any) {
      setError(err.message || 'No se pudo crear la clínica.');
    } finally {
      setSubmitting(false);
    }
  };

  const slugHint = () => {
    if (slugStatus === 'checking') return { color: 'text-gray-400', text: 'Verificando…' };
    if (slugStatus === 'ok') return { color: 'text-green-600', text: 'Disponible' };
    if (slugStatus === 'taken') return { color: 'text-red-600', text: 'Ese subdominio ya está en uso' };
    if (slugStatus === 'invalid') return { color: 'text-red-600', text: 'Solo minúsculas, números y guiones (3-40)' };
    return { color: 'text-gray-400', text: 'Mínimo 3 caracteres' };
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#eaf6fb] via-blue-50 to-[#e6fbfd] flex flex-col items-center justify-center p-4">
      <img src="/icono.png" alt="" aria-hidden="true"
        className="pointer-events-none select-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(80vw,560px)] max-w-none opacity-[0.07]" />

      <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <img src="/icono.png" alt="odontiacloud" className="h-16 w-16 object-contain mx-auto mb-3" />
        <h1 className="text-lg font-bold text-gray-900 text-center">Crea tu clínica</h1>
        <p className="text-sm text-gray-500 text-center mb-5">Tu propio espacio en odontiacloud, en menos de un minuto.</p>

        {/* Paso 1: autenticación con Google */}
        {step === 'auth' && (
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-4">Inicia sesión con tu cuenta de Google. Esa será la cuenta administradora de la clínica.</p>
            <div className="flex justify-center min-h-[44px]">
              <div ref={btnRef} />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-4">{error}</p>}
          </div>
        )}

        {/* Paso 2: nombre + slug */}
        {step === 'form' && (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
              Administrarás esta clínica con <span className="font-medium text-gray-800">{googleEmail || 'tu cuenta de Google'}</span>.
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Nombre de la clínica *</label>
              <input required type="text" className="input" value={name}
                onChange={e => setName(e.target.value)} placeholder="Ej. Dental del Sur" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Identificador (URL) *</label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-gray-500 whitespace-nowrap">odontiacloud.com/</span>
                <input required type="text" className="input flex-1" value={slug}
                  onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="dental-sur" autoComplete="off" />
              </div>
              <p className={`text-xs mt-1 flex items-center gap-1 ${slugHint().color}`}>
                {slugStatus === 'ok' && <CheckCircle className="w-3.5 h-3.5" />}
                {(slugStatus === 'taken' || slugStatus === 'invalid') && <AlertCircle className="w-3.5 h-3.5" />}
                {slugHint().text}
              </p>
            </div>

            <label className="flex items-start gap-2 text-xs text-gray-700 bg-gray-50 rounded-lg px-3 py-2 cursor-pointer">
              <input type="checkbox" className="mt-0.5 accent-blue-600" checked={acceptedTerms}
                onChange={e => setAcceptedTerms(e.target.checked)} />
              <span>
                He leído y acepto los{' '}
                <button type="button" onClick={() => setShowTerms(true)}
                  className="text-blue-600 underline hover:text-blue-700">
                  Términos de Servicio{terms ? ` (${terms.version})` : ''}
                </button>.
              </span>
            </label>

            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

            <button type="submit" disabled={submitting || slugStatus !== 'ok' || !acceptedTerms || !terms}
              className="w-full py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
              {submitting ? 'Creando…' : 'Crear clínica'}
            </button>
          </form>
        )}

        {/* Modal con el texto completo de los Términos */}
        {showTerms && terms && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowTerms(false)}>
            <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-3 border-b">
                <h3 className="text-sm font-semibold text-gray-900">Términos de Servicio · {terms.version}</h3>
                <button onClick={() => setShowTerms(false)} className="p-1 rounded hover:bg-gray-100">
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              <div className="px-5 py-4 overflow-y-auto whitespace-pre-wrap text-sm text-gray-700 leading-relaxed font-mono">
                {terms.content}
              </div>
              <div className="px-5 py-3 border-t flex justify-end gap-2">
                <button onClick={() => setShowTerms(false)}
                  className="px-4 py-1.5 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">Cerrar</button>
                <button onClick={() => { setAcceptedTerms(true); setShowTerms(false); }}
                  className="px-4 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700">Aceptar</button>
              </div>
            </div>
          </div>
        )}

        {/* Paso 3: éxito */}
        {step === 'done' && created && (
          <div className="text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h2 className="text-base font-semibold text-gray-900 mb-1">¡Tu clínica está lista!</h2>
            <p className="text-sm text-gray-600 mb-5">
              <span className="font-medium">{created.name}</span> ahora vive en su propio espacio.
            </p>
            <a href={clinicUrl(created.slug)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700">
              Entrar a /{created.slug} <ArrowRight className="w-4 h-4" />
            </a>
            <p className="text-xs text-gray-400 mt-4">Inicia sesión con tu cuenta de Google.</p>
          </div>
        )}

        <div className="text-center mt-6">
          <Link to="/" className="text-xs text-gray-400 hover:underline">Volver al inicio</Link>
        </div>
      </div>
    </div>
  );
}
