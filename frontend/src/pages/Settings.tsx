import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Languages, Check, Wallet } from 'lucide-react';
import { api, FinanceSettings } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import LanguageToggle from '../components/LanguageToggle';

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

  useEffect(() => {
    api.finance.settings().then(s => {
      setFinance(s);
      setFinanceForm({ currency: s.currency, tax_rate: String(s.tax_rate) });
    }).catch(() => {});
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

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      </div>
    </div>
  );
}
