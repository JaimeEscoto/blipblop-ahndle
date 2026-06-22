import { useEffect, useRef, useState, useCallback } from 'react';
import { api, ClinicSummary, ActivityLog, SuperStorageReport, VisitsReport, getToken, setToken, clearToken } from '../api/client';
import { clinicUrl } from '../tenant';
import { Shield, Building2, ExternalLink, RefreshCw, LogOut, Users, Calendar, Activity, HardDrive, AlertCircle, Globe2 } from 'lucide-react';

function fmtBytes(b: number): string {
  if (b < 1_000_000) return `${(b / 1024).toFixed(0)} KB`;
  if (b < 1_000_000_000) return `${(b / 1_000_000).toFixed(1)} MB`;
  return `${(b / 1_000_000_000).toFixed(2)} GB`;
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

declare global { interface Window { google?: any; } }

type Tab = 'clinics' | 'activity' | 'storage' | 'traffic';

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
  const [storage, setStorage] = useState<SuperStorageReport | null>(null);
  const [traffic, setTraffic] = useState<VisitsReport | null>(null);
  const [trafficDays, setTrafficDays] = useState<number>(30);
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

  const loadStorage = useCallback(async () => {
    setLoading(true);
    try { setStorage(await api.super.storage()); } finally { setLoading(false); }
  }, []);

  const loadTraffic = useCallback(async () => {
    setLoading(true);
    try { setTraffic(await api.super.visits({ days: trafficDays, limit: 200 })); }
    finally { setLoading(false); }
  }, [trafficDays]);

  useEffect(() => { loadClinics(); loadStorage(); }, [loadClinics, loadStorage]);
  useEffect(() => { if (tab === 'activity') loadActivity(); }, [tab, loadActivity]);
  useEffect(() => { if (tab === 'storage') loadStorage(); }, [tab, loadStorage]);
  useEffect(() => { if (tab === 'traffic') loadTraffic(); }, [tab, loadTraffic]);

  // Banner global de alerta de almacenamiento (visible en cualquier pestaña)
  const storageBanner = storage && (storage.global_used / storage.global_limit) > 0.8 ? storage : null;

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
            <button onClick={() => setTab('traffic')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${tab==='traffic' ? 'bg-gray-700' : 'text-gray-300 hover:bg-gray-800'}`}>
              <Globe2 className="w-4 h-4 inline mr-1.5 -mt-0.5" />Tráfico
            </button>
            <button onClick={() => setTab('storage')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${tab==='storage' ? 'bg-gray-700' : 'text-gray-300 hover:bg-gray-800'} ${storageBanner?.global_over ? 'ring-2 ring-red-500' : ''}`}>
              <HardDrive className="w-4 h-4 inline mr-1.5 -mt-0.5" />Almacenamiento
              {storageBanner?.global_over && <span className="ml-1.5 inline-block w-2 h-2 bg-red-400 rounded-full" />}
            </button>
            <button onClick={onLogout} title="Cerrar sesión"
              className="ml-2 p-2 text-gray-300 hover:bg-gray-800 rounded-lg">
              <LogOut className="w-4 h-4" />
            </button>
          </nav>
        </div>
      </header>

      {/* Banner global de almacenamiento (visible en cualquier pestaña) */}
      {storageBanner && (
        <div className={`${storageBanner.global_over ? 'bg-red-50 border-b border-red-200 text-red-900' : 'bg-amber-50 border-b border-amber-200 text-amber-900'}`}>
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
            <AlertCircle className={`w-5 h-5 shrink-0 ${storageBanner.global_over ? 'text-red-600' : 'text-amber-600'}`} />
            <div className="flex-1 text-sm">
              <p className="font-semibold">
                {storageBanner.global_over
                  ? 'Sistema lleno: nadie puede subir archivos.'
                  : 'Almacenamiento casi al límite.'}
              </p>
              <p className="text-xs">
                {fmtBytes(storageBanner.global_used)} de {fmtBytes(storageBanner.global_limit)} usados
                ({((storageBanner.global_used / storageBanner.global_limit) * 100).toFixed(1)}%).
                {' '}<button onClick={() => setTab('storage')} className="underline">Ver desglose →</button>
              </p>
            </div>
          </div>
        </div>
      )}

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

        {tab === 'storage' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-bold text-gray-900">Almacenamiento</h1>
              <button onClick={loadStorage} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
                <RefreshCw className="w-4 h-4" /> Actualizar
              </button>
            </div>
            {!storage ? <p className="text-gray-400 text-sm py-10 text-center">Cargando…</p> : (
              <>
                {/* Tarjeta global */}
                <div className={`rounded-xl border shadow-sm p-5 mb-4 ${storage.global_over ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm text-gray-500">Uso total del sistema</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {fmtBytes(storage.global_used)}
                        <span className="text-sm font-normal text-gray-500"> / {fmtBytes(storage.global_limit)}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-gray-900">
                        {((storage.global_used / storage.global_limit) * 100).toFixed(1)}<span className="text-base font-normal text-gray-500">%</span>
                      </p>
                      {storage.global_over && <p className="text-xs font-semibold text-red-600 mt-1">LÍMITE ALCANZADO</p>}
                    </div>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${
                      storage.global_over ? 'bg-red-500'
                      : (storage.global_used / storage.global_limit) > 0.8 ? 'bg-amber-500'
                      : 'bg-blue-500'
                    }`} style={{ width: `${Math.min(100, (storage.global_used / storage.global_limit) * 100)}%` }} />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Cuando se alcanza este límite, ninguna clínica puede subir archivos hasta que se libere espacio.
                  </p>
                </div>

                {/* Por clínica */}
                <h2 className="text-sm font-semibold text-gray-700 mb-2">Por clínica · 1 GB por clínica</h2>
                {storage.clinics.length === 0 ? (
                  <p className="text-gray-400 text-sm py-6 text-center">Sin clínicas todavía.</p>
                ) : (
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50 overflow-hidden">
                    {storage.clinics.map(c => {
                      const pct = (c.used / c.limit) * 100;
                      return (
                        <div key={c.clinic_id} className="px-4 py-3">
                          <div className="flex items-center justify-between gap-3 mb-1.5">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                              <p className="text-xs text-gray-400">
                                {c.slug} · {c.files} archivo{c.files !== 1 ? 's' : ''}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className={`text-sm font-medium ${c.over_limit ? 'text-red-700' : 'text-gray-900'}`}>
                                {fmtBytes(c.used)} <span className="text-gray-400 font-normal">/ {fmtBytes(c.limit)}</span>
                              </p>
                              <p className="text-[10px] text-gray-400">{pct.toFixed(1)}%</p>
                            </div>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${
                              c.over_limit ? 'bg-red-500'
                              : pct > 80 ? 'bg-amber-500'
                              : 'bg-blue-500'
                            }`} style={{ width: `${Math.min(100, pct)}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {tab === 'traffic' && (
          <>
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">Tráfico del sitio público</h1>
              <div className="flex items-center gap-2">
                <select value={trafficDays} onChange={e => setTrafficDays(Number(e.target.value))}
                        className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
                  <option value={1}>Últimas 24 h</option>
                  <option value={7}>Últimos 7 días</option>
                  <option value={30}>Últimos 30 días</option>
                  <option value={90}>Últimos 90 días</option>
                  <option value={365}>Último año</option>
                </select>
                <button onClick={loadTraffic} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
                  <RefreshCw className="w-4 h-4" /> Actualizar
                </button>
              </div>
            </div>

            {!traffic ? <p className="text-gray-400 text-sm py-10 text-center">Cargando…</p> : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <TrafficStat label="Visitas" value={traffic.total_visits} />
                  <TrafficStat label="Sesiones únicas" value={traffic.total_sessions} />
                  <TrafficStat label="Países" value={traffic.by_country.filter(c => c.country !== 'Desconocido').length} />
                  <TrafficStat label="Navegadores" value={traffic.by_browser.length} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <Breakdown title="Fuente de tráfico" rows={traffic.by_source.map(r => ({ label: r.source, value: r.visits }))} total={traffic.total_visits} />
                  <Breakdown title="País" rows={traffic.by_country.map(r => ({
                    label: r.country_code ? `${flagEmoji(r.country_code)} ${r.country}` : r.country, value: r.visits,
                  }))} total={traffic.total_visits} />
                  <Breakdown title="Navegador" rows={traffic.by_browser.map(r => ({ label: r.browser, value: r.visits }))} total={traffic.total_visits} />
                  <Breakdown title="Sistema operativo" rows={traffic.by_os.map(r => ({ label: r.os, value: r.visits }))} total={traffic.total_visits} />
                  <Breakdown title="Dispositivo" rows={traffic.by_device.map(r => ({ label: r.device, value: r.visits }))} total={traffic.total_visits} />
                </div>

                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-900 text-sm">Visitas recientes</h3>
                    <p className="text-xs text-gray-500">Últimas {traffic.recent.length}</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-50 text-gray-500">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">Fecha</th>
                          <th className="text-left px-3 py-2 font-medium">Fuente</th>
                          <th className="text-left px-3 py-2 font-medium">Ruta</th>
                          <th className="text-left px-3 py-2 font-medium">País / Ciudad</th>
                          <th className="text-left px-3 py-2 font-medium">Navegador</th>
                          <th className="text-left px-3 py-2 font-medium">SO</th>
                          <th className="text-left px-3 py-2 font-medium">Disp.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {traffic.recent.map(v => (
                          <tr key={v.id} className="border-t border-gray-100">
                            <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{fmt(v.created_at)}</td>
                            <td className="px-3 py-2 text-gray-900">{v.referrer_source || 'Directo'}</td>
                            <td className="px-3 py-2 text-gray-600 font-mono truncate max-w-[160px]" title={v.path || ''}>{v.path}</td>
                            <td className="px-3 py-2 text-gray-600">
                              {v.country_code ? `${flagEmoji(v.country_code)} ` : ''}{v.country || '—'}
                              {v.city ? <span className="text-gray-400"> · {v.city}</span> : null}
                            </td>
                            <td className="px-3 py-2 text-gray-600">{v.browser || '—'}</td>
                            <td className="px-3 py-2 text-gray-600">{v.os || '—'}</td>
                            <td className="px-3 py-2 text-gray-600">{v.device || '—'}</td>
                          </tr>
                        ))}
                        {traffic.recent.length === 0 && (
                          <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-400">Sin visitas en este período.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
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

function TrafficStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-2xl font-bold text-gray-900 mt-1">{value.toLocaleString('es-ES')}</div>
    </div>
  );
}

function Breakdown({ title, rows, total }: { title: string; rows: { label: string; value: number }[]; total: number }) {
  const max = Math.max(1, ...rows.map(r => r.value));
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <h3 className="font-semibold text-gray-900 text-sm mb-3">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-gray-400">Sin datos.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.slice(0, 8).map((r, i) => {
            const pct = total ? Math.round((r.value / total) * 100) : 0;
            return (
              <li key={i}>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-gray-700 truncate pr-2">{r.label}</span>
                  <span className="text-gray-500 whitespace-nowrap">{r.value.toLocaleString('es-ES')} · {pct}%</span>
                </div>
                <div className="mt-1 h-1.5 bg-gray-100 rounded">
                  <div className="h-1.5 bg-blue-500 rounded" style={{ width: `${(r.value / max) * 100}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// Emoji bandera a partir del código ISO de país (regional indicators).
function flagEmoji(code: string): string {
  if (!code || code.length !== 2) return '';
  const cc = code.toUpperCase();
  return String.fromCodePoint(...cc.split('').map(c => 0x1f1e6 - 65 + c.charCodeAt(0)));
}
