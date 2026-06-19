import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { api, Doctor } from '../api/client';
import { Plus, Pencil, Trash2, Search, Phone, Mail, Award } from 'lucide-react';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';

const SPECIALTIES = [
  'Odontología General', 'Ortodoncia', 'Endodoncia', 'Periodoncia',
  'Cirugía Maxilofacial', 'Odontopediatría', 'Prostodoncia', 'Implantología',
  'Estética Dental', 'Patología Oral', 'Radiología Oral', 'Otra',
];

const EMPTY: Omit<Doctor, 'id' | 'created_at'> = { name: '', specialty: '', email: '', phone: '', license_number: '' };

export default function Doctors() {
  const { t } = useTranslation();
  const specialtyLabel = (s: string) => t(`doctors.specialties.${s}`, { defaultValue: s });
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ type: 'create' | 'edit'; doctor?: Doctor } | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const data = await api.doctors.list();
    setDoctors(data);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm(EMPTY); setError(''); setModal({ type: 'create' }); };
  const openEdit = (d: Doctor) => {
    setForm({ name: d.name, specialty: d.specialty, email: d.email, phone: d.phone || '', license_number: d.license_number || '' });
    setError(''); setModal({ type: 'edit', doctor: d });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      if (modal?.type === 'create') await api.doctors.create(form);
      else await api.doctors.update(modal!.doctor!.id, form);
      await load();
      setModal(null);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await api.doctors.delete(deleteId);
    await load();
    setDeleteId(null);
  };

  const filtered = doctors.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.specialty.toLowerCase().includes(search.toLowerCase()) ||
    d.email.toLowerCase().includes(search.toLowerCase())
  );

  const specialtyColors: Record<string, string> = {
    'Odontología General': 'bg-green-100 text-green-700',
    'Ortodoncia': 'bg-blue-100 text-blue-700',
    'Endodoncia': 'bg-red-100 text-red-700',
    'Periodoncia': 'bg-pink-100 text-pink-700',
    'Cirugía Maxilofacial': 'bg-orange-100 text-orange-700',
    'Odontopediatría': 'bg-yellow-100 text-yellow-700',
    'Prostodoncia': 'bg-purple-100 text-purple-700',
    'Implantología': 'bg-indigo-100 text-indigo-700',
    'Estética Dental': 'bg-cyan-100 text-cyan-700',
    'Patología Oral': 'bg-amber-100 text-amber-700',
    'Radiología Oral': 'bg-slate-100 text-slate-700',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('doctors.title')}</h1>
          <p className="text-sm text-gray-500">{t('doctors.registeredCount', { count: doctors.length })}</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus className="w-4 h-4" /> {t('common.new')}
        </button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={t('doctors.searchPlaceholder')}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">{t('doctors.noneFound')}</div>
        )}
        {filtered.map(d => (
          <div key={d.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-900">Dr. {d.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${specialtyColors[d.specialty] || 'bg-blue-100 text-blue-700'}`}>
                    {specialtyLabel(d.specialty)}
                  </span>
                </div>
                <div className="mt-1.5 space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{d.email}</span>
                  </div>
                  {d.phone && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Phone className="w-3.5 h-3.5 shrink-0" />
                      <span>{d.phone}</span>
                    </div>
                  )}
                  {d.license_number && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Award className="w-3.5 h-3.5 shrink-0" />
                      <span>{t('doctors.license', { license: d.license_number })}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => openEdit(d)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => setDeleteId(d.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <Modal title={modal.type === 'create' ? t('doctors.createTitle') : t('doctors.editTitle')} onClose={() => setModal(null)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">{t('doctors.fullName')} *</label>
              <input required className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={t('doctors.fullNamePlaceholder')} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">{t('doctors.specialty')} *</label>
              <select required className="input" value={form.specialty} onChange={e => setForm({ ...form, specialty: e.target.value })}>
                <option value="">{t('doctors.selectSpecialty')}</option>
                {SPECIALTIES.map(s => <option key={s} value={s}>{specialtyLabel(s)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">{t('doctors.email')} *</label>
              <input required type="email" className="input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder={t('doctors.emailPlaceholder')} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">{t('doctors.phone')}</label>
              <input className="input" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+57 300 000 0000" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">{t('doctors.licenseNumber')}</label>
              <input className="input" value={form.license_number || ''} onChange={e => setForm({ ...form, license_number: e.target.value })} placeholder={t('doctors.licenseNumberPlaceholder')} />
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setModal(null)} className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                {t('common.cancel')}
              </button>
              <button type="submit" disabled={loading} className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
                {loading ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleteId && (
        <ConfirmDialog
          message={t('doctors.deleteConfirm')}
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}
