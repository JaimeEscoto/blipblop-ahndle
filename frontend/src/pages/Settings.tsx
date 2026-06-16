import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Languages, Check } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import LanguageToggle from '../components/LanguageToggle';

export default function Settings() {
  const { t } = useTranslation();
  const { account, setAccountLanguage } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const changeLanguage = async (lang: 'es' | 'en') => {
    if (account?.language === lang) return;
    setSaving(true); setError(''); setSaved(false);
    // Aplica de inmediato en la UI; persiste en la cuenta
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

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">{t('settings.title')}</h1>
        <p className="text-sm text-gray-500">{t('settings.subtitle')}</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 max-w-lg">
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

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-3">{error}</p>}
      </div>
    </div>
  );
}
