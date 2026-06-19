import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, DiscoverClinic, setToken } from '../api/client';
import { Building2, ArrowRight, Plus, Shield } from 'lucide-react';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

declare global { interface Window { google?: any; } }

type View = 'auth' | 'picker' | 'none';

export default function GlobalLogin() {
  const btnRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>('auth');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [clinics, setClinics] = useState<DiscoverClinic[]>([]);

  useEffect(() => {
    if (view !== 'auth') return;
    if (!CLIENT_ID) { setError('Falta configurar VITE_GOOGLE_CLIENT_ID.'); return; }

    const handle = async (resp: any) => {
      setError(''); setLoading(true);
      try {
        const r = await api.auth.discover(resp.credential);
        // Super admin → directo al portal
        if ('super' in r) {
          setToken(r.super.token);
          window.location.href = `${window.location.origin}/superadmin/`;
          return;
        }
        // Una sola clínica → entra directo
        if (r.clinics.length === 1) {
          const c = r.clinics[0];
          setToken(c.token);
          window.location.href = `${window.location.origin}/${c.clinic_slug}/inicio`;
          return;
        }
        // Varias clínicas → muestra selector
        setClinics(r.clinics);
        setView('picker');
      } catch (e: any) {
        // 403 = el correo no tiene acceso a ninguna clínica
        if (/no está registrado|no tiene/.test(e.message)) {
          setView('none');
        } else {
          setError(e.message || 'No se pudo iniciar sesión');
        }
      } finally {
        setLoading(false);
      }
    };

    const init = () => {
      if (!window.google) return;
      window.google.accounts.id.initialize({ client_id: CLIENT_ID, callback: handle });
      if (btnRef.current) {
        btnRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(btnRef.current, {
          theme: 'outline', size: 'large', text: 'continue_with', shape: 'pill', width: 280,
        });
      }
    };

    if (window.google) { init(); return; }
    const existing = document.getElementById('gsi-script');
    if (existing) { existing.addEventListener('load', init); return; }
    const s = document.createElement('script');
    s.id = 'gsi-script'; s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.defer = true; s.onload = init;
    document.body.appendChild(s);
  }, [view]);

  const enterClinic = (c: DiscoverClinic) => {
    setToken(c.token);
    window.location.href = `${window.location.origin}/${c.clinic_slug}/inicio`;
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#eaf6fb] via-blue-50 to-[#e6fbfd] flex flex-col items-center justify-center p-4">
      <img src="/icono.png" alt="" aria-hidden="true"
        className="pointer-events-none select-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(80vw,560px)] max-w-none opacity-[0.07]" />

      <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <Link to="/" className="block">
          <img src="/icono.png" alt="odontiacloud" className="h-16 w-16 object-contain mx-auto mb-3" />
        </Link>

        {view === 'auth' && (
          <>
            <h1 className="text-lg font-bold text-gray-900 text-center">Inicia sesión</h1>
            <p className="text-sm text-gray-500 text-center mb-6">Entra con tu cuenta de Google.</p>
            <div className="flex justify-center min-h-[44px]">
              {loading ? <p className="text-sm text-gray-400">Verificando…</p> : <div ref={btnRef} />}
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-4">{error}</p>}
            <p className="text-xs text-gray-400 text-center mt-6">
              ¿No tienes clínica todavía? <Link to="/crear-clinica" className="text-blue-600 hover:underline">Crea una</Link>.
            </p>
          </>
        )}

        {view === 'picker' && (
          <>
            <h1 className="text-lg font-bold text-gray-900 text-center">Elige una clínica</h1>
            <p className="text-sm text-gray-500 text-center mb-5">Tienes acceso a varias clínicas.</p>
            <div className="space-y-2">
              {clinics.map(c => (
                <button key={c.clinic_id} onClick={() => enterClinic(c)}
                  className="w-full flex items-center gap-3 p-4 border border-gray-200 hover:border-blue-400 hover:bg-blue-50 rounded-xl transition-colors text-left">
                  <div className="shrink-0 p-2 bg-blue-100 text-blue-700 rounded-lg">
                    {c.role === 'clinic_admin' ? <Shield className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{c.clinic_name}</p>
                    <p className="text-xs text-gray-500 truncate">
                      odontiacloud.com/{c.clinic_slug} · {c.role === 'clinic_admin' ? 'Admin' : 'Equipo'}
                    </p>
                  </div>
                  <ArrowRight className="shrink-0 w-4 h-4 text-gray-400" />
                </button>
              ))}
            </div>
          </>
        )}

        {view === 'none' && (
          <>
            <h1 className="text-lg font-bold text-gray-900 text-center">Tu correo no está en ninguna clínica</h1>
            <p className="text-sm text-gray-500 text-center mb-6">
              Pide a un administrador que te invite, o crea tu propia clínica.
            </p>
            <Link to="/crear-clinica"
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" /> Crear mi clínica
            </Link>
            <button onClick={() => setView('auth')}
              className="w-full mt-2 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
              Probar con otra cuenta
            </button>
          </>
        )}

        <div className="text-center mt-6">
          <Link to="/" className="text-xs text-gray-400 hover:underline">Volver al inicio</Link>
        </div>
      </div>
    </div>
  );
}
