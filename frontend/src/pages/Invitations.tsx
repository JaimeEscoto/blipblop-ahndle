import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { api, Invitation } from '../api/client';
import { dateLocale } from '../i18n/format';
import { Plus, Trash2, Mail, CheckCircle, Clock, Copy, Check, MessageCircle } from 'lucide-react';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';

export default function Invitations() {
  const { t } = useTranslation();
  const [list, setList] = useState<Invitation[]>([]);
  const [modal, setModal] = useState(false);
  const [email, setEmail] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Mensaje de invitación listo para enviar
  const inviteMessage = (inv: Invitation) =>
    t('invitations.inviteMessage', { origin: window.location.origin, email: inv.email });

  const copyMessage = async (inv: Invitation) => {
    try {
      await navigator.clipboard.writeText(inviteMessage(inv));
      setCopiedId(inv.id);
      setTimeout(() => setCopiedId(c => (c === inv.id ? null : c)), 2000);
    } catch { /* el navegador puede bloquear clipboard sin gesto */ }
  };

  const waShare = (inv: Invitation) => `https://wa.me/?text=${encodeURIComponent(inviteMessage(inv))}`;

  const load = useCallback(async () => {
    try { setList(await api.invitations.list()); } catch { /* noop */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      await api.invitations.create(email.trim());
      setEmail(''); setModal(false); await load();
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await api.invitations.delete(deleteId);
    setDeleteId(null); await load();
  };

  const fmt = (d: string) => new Date(d).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('invitations.title')}</h1>
          <p className="text-sm text-gray-500">{t('invitations.subtitle')}</p>
        </div>
        <button onClick={() => { setError(''); setModal(true); }} className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus className="w-4 h-4" /> {t('invitations.invite')}
        </button>
      </div>

      <div className="space-y-2">
        {list.length === 0 && <div className="text-center py-12 text-gray-400 text-sm">{t('invitations.none')}</div>}
        {list.map(inv => (
          <div key={inv.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`shrink-0 p-2 rounded-lg ${inv.status === 'accepted' ? 'bg-green-100' : 'bg-amber-100'}`}>
                  <Mail className={`w-4 h-4 ${inv.status === 'accepted' ? 'text-green-600' : 'text-amber-600'}`} />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{inv.email}</p>
                  <p className="text-xs text-gray-400">{t('invitations.invitedOn', { date: fmt(inv.created_at) })}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {inv.status === 'accepted' ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full"><CheckCircle className="w-3.5 h-3.5" />{t('invitations.registered')}</span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-full"><Clock className="w-3.5 h-3.5" />{t('invitations.pending')}</span>
                )}
                <button onClick={() => setDeleteId(inv.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            {inv.status === 'pending' && (
              <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">
                <button onClick={() => copyMessage(inv)}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100">
                  {copiedId === inv.id ? <><Check className="w-3.5 h-3.5" /> {t('invitations.copied')}</> : <><Copy className="w-3.5 h-3.5" /> {t('invitations.copyMessage')}</>}
                </button>
                <a href={waShare(inv)} target="_blank" rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100">
                  <MessageCircle className="w-3.5 h-3.5" /> {t('common.whatsapp')}
                </a>
              </div>
            )}
          </div>
        ))}
      </div>

      {modal && (
        <Modal title={t('invitations.createTitle')} onClose={() => setModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">{t('invitations.googleEmail')} *</label>
              <input required type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} placeholder={t('invitations.googleEmailPlaceholder')} />
              <p className="text-xs text-gray-400 mt-1">{t('invitations.googleEmailHint')}</p>
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setModal(false)} className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">{t('common.cancel')}</button>
              <button type="submit" disabled={loading} className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
                {loading ? t('invitations.sending') : t('invitations.createAction')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleteId && <ConfirmDialog message={t('invitations.deleteConfirm')} onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />}
    </div>
  );
}
