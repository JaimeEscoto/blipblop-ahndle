import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity as ActivityIcon, Mail, Database, Download, Loader2, AlertTriangle } from 'lucide-react';
import Activity from './Activity';
import Invitations from './Invitations';
import { api } from '../api/client';

type Tab = 'activity' | 'invitations' | 'backup';

export default function SuperAdmin() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('activity');

  const tabs: { id: Tab; label: string; icon: typeof ActivityIcon }[] = [
    { id: 'activity', label: 'superadmin.activity', icon: ActivityIcon },
    { id: 'invitations', label: 'superadmin.invitations', icon: Mail },
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
      {tab === 'backup' && <BackupPanel />}
    </div>
  );
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
