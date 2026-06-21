import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Languages, Check, Wallet, HardDrive, AlertCircle, FileSignature, Plus, Pencil, Trash2 } from 'lucide-react';
import { api, FinanceSettings, StorageUsage, ConsentTemplate } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import LanguageToggle from '../components/LanguageToggle';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';

function fmtBytes(b: number): string {
  if (b < 1_000_000) return `${(b / 1024).toFixed(0)} KB`;
  if (b < 1_000_000_000) return `${(b / 1_000_000).toFixed(1)} MB`;
  return `${(b / 1_000_000_000).toFixed(2)} GB`;
}

const CURRENCY_OPTIONS = [
  { code: 'HNL', label: 'Lempira (HNL · L)' },
  { code: 'USD', label: 'Dólar (USD · $)' },
  { code: 'GTQ', label: 'Quetzal (GTQ · Q)' },
  { code: 'NIO', label: 'Córdoba (NIO · C$)' },
  { code: 'CRC', label: 'Colón (CRC · ₡)' },
  { code: 'MXN', label: 'Peso mexicano (MXN · $)' },
  { code: 'COP', label: 'Peso colombiano (COP · $)' },
  { code: 'PEN', label: 'Sol (PEN · S/)' },
  { code: 'EUR', label: 'Euro (EUR · €)' },
];

export default function Settings() {
  const { t } = useTranslation();
  const { account, setAccountLanguage } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Finanzas
  const [finance, setFinance] = useState<FinanceSettings | null>(null);
  const [financeForm, setFinanceForm] = useState({ currency: 'HNL', tax_rate: '0' });
  const [financeSaving, setFinanceSaving] = useState(false);
  const [financeSaved, setFinanceSaved] = useState(false);
  const isAdmin = account?.role === 'clinic_admin' || account?.role === 'superuser';

  // Almacenamiento
  const [usage, setUsage] = useState<StorageUsage | null>(null);

  useEffect(() => {
    api.finance.settings().then(s => {
      setFinance(s);
      setFinanceForm({ currency: s.currency, tax_rate: String(s.tax_rate) });
    }).catch(() => {});
    api.attachments.usage().then(setUsage).catch(() => {});
  }, []);

  const changeLanguage = async (lang: 'es' | 'en') => {
    if (account?.language === lang) return;
    setSaving(true); setError(''); setSaved(false);
    setAccountLanguage(lang);
    try {
      await api.auth.setLanguage(lang);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(e.message || t('settings.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const saveFinance = async (e: React.FormEvent) => {
    e.preventDefault();
    setFinanceSaving(true); setError(''); setFinanceSaved(false);
    try {
      const updated = await api.finance.updateSettings({
        currency: financeForm.currency,
        tax_rate: Number(financeForm.tax_rate) || 0,
      });
      setFinance(updated);
      setFinanceSaved(true);
      setTimeout(() => setFinanceSaved(false), 2000);
    } catch (e: any) {
      setError(e.message || 'No se pudo guardar');
    } finally {
      setFinanceSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">{t('settings.title')}</h1>
        <p className="text-sm text-gray-500">{t('settings.subtitle')}</p>
      </div>

      <div className="space-y-4 max-w-lg">
        {/* Idioma */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-1">
            <Languages className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-semibold text-gray-800">{t('settings.languageTitle')}</h2>
          </div>
          <p className="text-xs text-gray-500 mb-4">{t('settings.languageDescription')}</p>

          <div className="flex items-center gap-3">
            <LanguageToggle value={account?.language} onChange={changeLanguage} />
            {saving && <span className="text-xs text-gray-400">{t('common.saving')}</span>}
            {saved && !saving && (
              <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                <Check className="w-3.5 h-3.5" /> {t('settings.saved')}
              </span>
            )}
          </div>
        </div>

        {/* Almacenamiento */}
        {isAdmin && usage && (() => {
          const clinicPct = (usage.clinic_used / usage.clinic_limit) * 100;
          const globalPct = (usage.global_used / usage.global_limit) * 100;
          const clinicFull = usage.clinic_used >= usage.clinic_limit;
          const globalFull = usage.global_used >= usage.global_limit;
          const barColor = (pct: number, full: boolean) =>
            full ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-blue-500';
          const textColor = (full: boolean, pct: number) =>
            full ? 'text-red-700' : pct > 80 ? 'text-amber-700' : 'text-gray-700';

          return (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-1">
                <HardDrive className="w-4 h-4 text-blue-600" />
                <h2 className="text-sm font-semibold text-gray-800">Almacenamiento</h2>
              </div>
              <p className="text-xs text-gray-500 mb-4">
                Espacio utilizado por los archivos adjuntos en los expedientes.
              </p>

              {/* Uso de esta clínica */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-gray-600">Tu clínica</span>
                  <span className={`text-sm font-semibold ${textColor(clinicFull, clinicPct)}`}>
                    {fmtBytes(usage.clinic_used)} <span className="text-gray-400 font-normal">/ {fmtBytes(usage.clinic_limit)}</span>
                    <span className="text-xs text-gray-400 ml-1">({clinicPct.toFixed(1)}%)</span>
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${barColor(clinicPct, clinicFull)}`}
                    style={{ width: `${Math.min(100, clinicPct)}%` }} />
                </div>
                {clinicFull && (
                  <p className="mt-2 text-xs text-red-700 flex items-start gap-1">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    Tu clínica alcanzó el límite. Elimina archivos antiguos para liberar espacio o solicita una ampliación al administrador.
                  </p>
                )}
                {!clinicFull && clinicPct > 80 && (
                  <p className="mt-2 text-xs text-amber-700">
                    Ya usaste más del 80% del espacio de tu clínica.
                  </p>
                )}
              </div>

              {/* Uso del sistema (informativo, para que el admin sepa que hay un cap compartido) */}
              <div className="pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-gray-500">Sistema (todas las clínicas)</span>
                  <span className={`text-xs font-medium ${textColor(globalFull, globalPct)}`}>
                    {fmtBytes(usage.global_used)} <span className="text-gray-400 font-normal">/ {fmtBytes(usage.global_limit)}</span>
                  </span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${barColor(globalPct, globalFull)}`}
                    style={{ width: `${Math.min(100, globalPct)}%` }} />
                </div>
                {globalFull && (
                  <p className="mt-2 text-xs text-red-700 flex items-start gap-1">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    El sistema alcanzó el límite global. Nadie puede subir archivos hasta que se libere espacio.
                  </p>
                )}
              </div>
            </div>
          );
        })()}

        {/* Finanzas */}
        {isAdmin && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-semibold text-gray-800">Finanzas</h2>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Moneda e IVA por defecto para facturas. {finance && <>Próxima factura: <span className="font-medium">#{String(finance.next_invoice_number).padStart(4, '0')}</span></>}
            </p>

            <form onSubmit={saveFinance} className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Moneda</label>
                  <select className="input" value={financeForm.currency}
                    onChange={e => setFinanceForm({ ...financeForm, currency: e.target.value })}>
                    {CURRENCY_OPTIONS.map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">IVA por defecto (%)</label>
                  <input type="number" min="0" max="100" step="0.01" className="input"
                    value={financeForm.tax_rate}
                    onChange={e => setFinanceForm({ ...financeForm, tax_rate: e.target.value })} />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button type="submit" disabled={financeSaving}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
                  {financeSaving ? t('common.saving') : t('common.save')}
                </button>
                {financeSaved && (
                  <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                    <Check className="w-3.5 h-3.5" /> {t('settings.saved')}
                  </span>
                )}
              </div>
            </form>
          </div>
        )}

        {/* Plantillas de consentimientos */}
        {isAdmin && <ConsentTemplatesCard />}

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      </div>
    </div>
  );
}

// ── Plantillas de consentimientos (Ajustes) ─────────────────────────────

function ConsentTemplatesCard() {
  const [items, setItems] = useState<ConsentTemplate[]>([]);
  const [modal, setModal] = useState<{ tpl?: ConsentTemplate } | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({ title: '', body: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => setItems(await api.consents.templates(true)), []);
  useEffect(() => { load(); }, [load]);

  const open = (tpl?: ConsentTemplate) => {
    setForm({ title: tpl?.title || '', body: tpl?.body || '' });
    setError(''); setModal({ tpl });
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      if (modal?.tpl) await api.consents.updateTemplate(modal.tpl.id, { title: form.title.trim(), body: form.body.trim(), active: modal.tpl.active });
      else await api.consents.createTemplate({ title: form.title.trim(), body: form.body.trim() });
      await load(); setModal(null);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };
  const remove = async () => {
    if (!deleteId) return;
    await api.consents.deleteTemplate(deleteId);
    await load(); setDeleteId(null);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileSignature className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-semibold text-gray-800">Plantillas de consentimientos</h2>
        </div>
        <button onClick={() => open()} className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700">
          <Plus className="w-3.5 h-3.5" /> Nueva
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Documentos reutilizables que el paciente firma desde su expediente (informados, autorizaciones, etc.).
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-3">Sin plantillas todavía.</p>
      ) : (
        <div className="space-y-1.5">
          {items.map(t => (
            <div key={t.id} className="flex items-center gap-2 border border-gray-100 rounded-lg p-2">
              <FileSignature className="w-4 h-4 text-gray-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{t.title}</p>
                <p className="text-[10px] text-gray-400 truncate">{t.body.slice(0, 100)}</p>
              </div>
              <button onClick={() => open(t)} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={() => setDeleteId(t.id)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <Modal title={modal.tpl ? 'Editar plantilla' : 'Nueva plantilla'} onClose={() => setModal(null)}>
          <form onSubmit={submit} className="space-y-3">
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Título *</label>
              <input required className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ej. Consentimiento para endodoncia" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Contenido *</label>
              <textarea required className="input resize-none font-mono text-xs" rows={10} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} placeholder="Yo, _______, autorizo al Dr. ___ a realizar el siguiente procedimiento..." />
              <p className="text-[10px] text-gray-400 mt-1">El cuerpo se puede personalizar al firmar con cada paciente.</p>
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setModal(null)} className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancelar</button>
              <button type="submit" disabled={loading} className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
                {loading ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {deleteId && <ConfirmDialog message="¿Eliminar esta plantilla? Los consentimientos ya firmados con ella se conservan." onConfirm={remove} onCancel={() => setDeleteId(null)} />}
    </div>
  );
}
