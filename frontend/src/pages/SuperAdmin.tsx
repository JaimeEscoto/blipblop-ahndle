import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity as ActivityIcon, Mail, Database, Download, Loader2, AlertTriangle,
  Globe2, RefreshCw,
} from 'lucide-react';
import Activity from './Activity';
import Invitations from './Invitations';
import { api, VisitsReport } from '../api/client';

type Tab = 'activity' | 'invitations' | 'traffic' | 'backup';

export default function SuperAdmin() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('activity');

  const tabs: { id: Tab; label: string; icon: typeof ActivityIcon }[] = [
    { id: 'activity', label: 'superadmin.activity', icon: ActivityIcon },
    { id: 'invitations', label: 'superadmin.invitations', icon: Mail },
    { id: 'traffic', label: 'superadmin.traffic', icon: Globe2 },
    { id: 'backup', label: 'superadmin.backup', icon: Database },
  ];

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">{t('superadmin.title')}</h1>
        <p className="text-sm text-gray-500">{t('superadmin.subtitle')}</p>
      </div>

      <div className="flex gap-1 border-b border-gray-200 mb-5 overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
              tab === id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-4 h-4" /> {t(label)}
          </button>
        ))}
      </div>

      {tab === 'activity' && <Activity />}
      {tab === 'invitations' && <Invitations />}
      {tab === 'traffic' && <TrafficPanel />}
      {tab === 'backup' && <BackupPanel />}
    </div>
  );
}

function TrafficPanel() {
  const [data, setData] = useState<VisitsReport | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const r = await api.super.visits({ days, limit: 200 });
      setData(r);
    } catch (e: any) {
      setError(e.message || 'Error al cargar tráfico');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [days]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Período:</label>
          <select
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
          >
            <option value={1}>Últimas 24 h</option>
            <option value={7}>Últimos 7 días</option>
            <option value={30}>Últimos 30 días</option>
            <option value={90}>Últimos 90 días</option>
            <option value={365}>Último año</option>
          </select>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-blue-700 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Actualizar
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Visitas" value={data.total_visits} />
            <Stat label="Sesiones únicas" value={data.total_sessions} />
            <Stat label="Países" value={data.by_country.filter(c => c.country !== 'Desconocido').length} />
            <Stat label="Navegadores" value={data.by_browser.length} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Breakdown title="Fuente de tráfico" rows={data.by_source.map(r => ({ label: r.source, value: r.visits }))} total={data.total_visits} />
            <Breakdown
              title="País"
              rows={data.by_country.map(r => ({
                label: r.country_code ? `${flag(r.country_code)} ${r.country}` : r.country,
                value: r.visits,
              }))}
              total={data.total_visits}
            />
            <Breakdown title="Navegador" rows={data.by_browser.map(r => ({ label: r.browser, value: r.visits }))} total={data.total_visits} />
            <Breakdown title="Sistema operativo" rows={data.by_os.map(r => ({ label: r.os, value: r.visits }))} total={data.total_visits} />
            <Breakdown title="Dispositivo" rows={data.by_device.map(r => ({ label: r.device, value: r.visits }))} total={data.total_visits} />
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 text-sm">Visitas recientes</h3>
              <p className="text-xs text-gray-500">Últimas {data.recent.length}</p>
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
                  {data.recent.map(v => (
                    <tr key={v.id} className="border-t border-gray-100">
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{new Date(v.created_at).toLocaleString()}</td>
                      <td className="px-3 py-2 text-gray-900">{v.referrer_source || 'Directo'}</td>
                      <td className="px-3 py-2 text-gray-600 font-mono truncate max-w-[160px]" title={v.path || ''}>{v.path}</td>
                      <td className="px-3 py-2 text-gray-600">
                        {v.country_code ? `${flag(v.country_code)} ` : ''}{v.country || '—'}
                        {v.city ? <span className="text-gray-400"> · {v.city}</span> : null}
                      </td>
                      <td className="px-3 py-2 text-gray-600">{v.browser || '—'}</td>
                      <td className="px-3 py-2 text-gray-600">{v.os || '—'}</td>
                      <td className="px-3 py-2 text-gray-600">{v.device || '—'}</td>
                    </tr>
                  ))}
                  {data.recent.length === 0 && (
                    <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-400">Sin visitas en este período.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-2xl font-bold text-gray-900 mt-1">{value.toLocaleString()}</div>
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
                  <span className="text-gray-500 whitespace-nowrap">{r.value.toLocaleString()} · {pct}%</span>
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

// Emoji bandera a partir del código ISO de país (AA-Z → regional indicators).
function flag(code: string): string {
  if (!code || code.length !== 2) return '';
  const cc = code.toUpperCase();
  return String.fromCodePoint(...cc.split('').map(c => 0x1f1e6 - 65 + c.charCodeAt(0)));
}

function BackupPanel() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const download = async () => {
    setLoading(true);
    setError('');
    try {
      const { blob, filename } = await api.admin.backup();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message || t('superadmin.backupError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-start gap-4">
          <div className="shrink-0 p-3 rounded-xl bg-blue-100">
            <Database className="w-6 h-6 text-blue-600" />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-gray-900">{t('superadmin.backupTitle')}</h2>
            <p className="text-sm text-gray-500 mt-1">{t('superadmin.backupDesc')}</p>

            <div className="mt-3 flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg p-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{t('superadmin.backupWarning')}</span>
            </div>

            <button
              onClick={download}
              disabled={loading}
              className="mt-4 inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {loading ? t('superadmin.backupGenerating') : t('superadmin.backupButton')}
            </button>
            {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
