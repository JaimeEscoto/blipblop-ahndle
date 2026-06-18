import { useEffect, useRef, useState, useCallback } from 'react';
import { api, ClinicSummary, ActivityLog, getToken, setToken, clearToken } from '../api/client';
import { clinicUrl } from '../tenant';
import { Shield, Building2, ExternalLink, RefreshCw, LogOut, Users, Calendar, Activity } from 'lucide-react';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

declare global { interface Window { google?: any; } }

type Tab = 'clinics' | 'activity';

interface SuperActivity extends ActivityLog {
  clinic_slug: string | null;
  clinic_name: string | null;
}

export default function SuperAdminPortal() {
  const [authed, setAuthed] = useState<boolean>(!!getToken());
  const [loadingMe, setLoadingMe] = useState<boolean>(!!getToken());

  // Verifica que el token guardado siga siendo válido y del super admin
  useEffect(() => {
    if (!getToken()) return;
    api.auth.me()
      .then(r => {
        if (r.account.role === 'superuser' && r.account.clinic_id === null) {
          setAuthed(true);
        } else {
          clearToken(); setAuthed(false);
        }
      })
      .catch(() => { clearToken(); setAuthed(false); })
      .finally(() => setLoadingMe(false));
  }, []);

  if (loadingMe) return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Cargando…</div>;
  if (!authed) return <SuperLogin onLogged={() => setAuthed(true)} />;
  return <SuperDashboard onLogout={() => { clearToken(); setAuthed(false); }} />;
}

function SuperLogin({ onLogged }: { onLogged: () => void }) {
  const btnRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!CLIENT_ID) { setError('Falta configurar VITE_GOOGLE_CLIENT_ID.'); return; }

    const handle = async (resp: any) => {
      try {
        const r = await api.auth.superGoogle(resp.credential);
        setToken(r.token);
        onLogged();
      } catch (e: any) {
        setError(e.message || 'No se pudo iniciar sesión');
      }
    };

    const init = () => {
      if (!window.google) return;
      window.google.accounts.id.initialize({ client_id: CLIENT_ID, callback: handle });
      if (btnRef.current) {
        btnRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(btnRef.current, { theme: 'filled_black', size: 'large', text: 'continue_with', shape: 'pill', width: 280 });
      }
    };

    if (window.google) { init(); return; }
    const existing = document.getElementById('gsi-script');
    if (existing) { existing.addEventListener('load', init); return; }
    const s = document.createElement('script');
    s.id = 'gsi-script'; s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.defer = true; s.onload = init;
    document.body.appendChild(s);
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-gray-900 flex flex-col items-center justify-center p-4">
      <img src="/icono.png" alt="" aria-hidden="true"
        className="pointer-events-none select-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(80vw,560px)] max-w-none opacity-[0.04]" />

      <div className="relative z-10 w-full max-w-sm bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl p-8 text-center">
        <Shield className="w-12 h-12 text-amber-400 mx-auto mb-3" />
        <h1 className="text-lg font-bold text-white">Portal Super Admin</h1>
        <p className="text-sm text-gray-400 mb-6">Acceso restringido</p>
        <div className="flex justify-center min-h-[44px]">
          <div ref={btnRef} />
        </div>
        {error && <p className="text-sm text-red-300 bg-red-900/30 rounded-lg px-3 py-2 mt-4">{error}</p>}
      </div>
    </div>
  );
}

function SuperDashboard({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('clinics');
  const [clinics, setClinics] = useState<ClinicSummary[]>([]);
  const [activity, setActivity] = useState<SuperActivity[]>([]);
  const [filterClinic, setFilterClinic] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);

  const loadClinics = useCallback(async () => {
    setLoading(true);
    try { setClinics(await api.super.clinics()); } finally { setLoading(false); }
  }, []);

  const loadActivity = useCallback(async () => {
    setLoading(true);
    try { setActivity(await api.super.activity({ clinic_id: filterClinic || undefined, limit: 200 })); }
    finally { setLoading(false); }
  }, [filterClinic]);

  useEffect(() => { loadClinics(); }, [loadClinics]);
  useEffect(() => { if (tab === 'activity') loadActivity(); }, [tab, loadActivity]);

  const fmt = (s: string | null) => s ? new Date(s).toLocaleString('es-ES') : '—';

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-gray-900 text-white sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-400" />
            <span className="font-semibold">Super Admin · odontiacloud</span>
          </div>
          <nav className="flex items-center gap-1">
            <button onClick={() => setTab('clinics')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${tab==='clinics' ? 'bg-gray-700' : 'text-gray-300 hover:bg-gray-800'}`}>
              <Building2 className="w-4 h-4 inline mr-1.5 -mt-0.5" />Clínicas
            </button>
            <button onClick={() => setTab('activity')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${tab==='activity' ? 'bg-gray-700' : 'text-gray-300 hover:bg-gray-800'}`}>
              <Activity className="w-4 h-4 inline mr-1.5 -mt-0.5" />Actividad
            </button>
            <button onClick={onLogout} title="Cerrar sesión"
              className="ml-2 p-2 text-gray-300 hover:bg-gray-800 rounded-lg">
              <LogOut className="w-4 h-4" />
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {tab === 'clinics' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-bold text-gray-900">Clínicas registradas</h1>
              <button onClick={loadClinics} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
                <RefreshCw className="w-4 h-4" /> Actualizar
              </button>
            </div>
            {loading ? <p className="text-gray-400 text-sm py-10 text-center">Cargando…</p> :
              clinics.length === 0 ? <p className="text-gray-400 text-sm py-10 text-center">No hay clínicas todavía.</p> :
              <div className="grid sm:grid-cols-2 gap-3">
                {clinics.map(c => (
                  <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{c.name}</p>
                        <p className="text-xs text-gray-500 truncate">{c.slug}.odontiacloud.com</p>
                      </div>
                      <a href={clinicUrl(c.slug)} target="_blank" rel="noopener noreferrer"
                         title="Entrar como super admin (sigiloso)"
                         className="shrink-0 p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <Users className="w-3.5 h-3.5 inline -mt-0.5 text-gray-400" />
                        <p className="font-semibold text-gray-900">{c.account_count}</p>
                        <p className="text-gray-500">usuarios</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <Users className="w-3.5 h-3.5 inline -mt-0.5 text-gray-400" />
                        <p className="font-semibold text-gray-900">{c.patient_count}</p>
                        <p className="text-gray-500">pacientes</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <Calendar className="w-3.5 h-3.5 inline -mt-0.5 text-gray-400" />
                        <p className="font-semibold text-gray-900">{c.appointment_count}</p>
                        <p className="text-gray-500">citas</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-3">
                      Dueño: <span className="text-gray-600">{c.owner_email || '—'}</span><br/>
                      Última actividad: <span className="text-gray-600">{fmt(c.last_activity_at)}</span>
                    </p>
                  </div>
                ))}
              </div>
            }
          </>
        )}

        {tab === 'activity' && (
          <>
            <div className="flex items-center justify-between mb-4 gap-3">
              <h1 className="text-xl font-bold text-gray-900">Actividad consolidada</h1>
              <div className="flex items-center gap-2">
                <select value={filterClinic} onChange={e => setFilterClinic(e.target.value ? Number(e.target.value) : '')}
                        className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
                  <option value="">Todas las clínicas</option>
                  {clinics.map(c => <option key={c.id} value={c.id}>{c.slug}</option>)}
                </select>
                <button onClick={loadActivity} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>
            {loading ? <p className="text-gray-400 text-sm py-10 text-center">Cargando…</p> :
              activity.length === 0 ? <p className="text-gray-400 text-sm py-10 text-center">Sin eventos.</p> :
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50 overflow-hidden">
                {activity.map(e => (
                  <div key={e.id} className="px-4 py-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-gray-900">{e.summary}</span>
                        {e.internal && (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">SOMBRA</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        {e.account_email || '—'} · <span className="text-blue-600">{e.clinic_slug || 'sin clínica'}</span>
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-gray-400">{fmt(e.created_at)}</span>
                  </div>
                ))}
              </div>
            }
          </>
        )}
      </main>
    </div>
  );
}
