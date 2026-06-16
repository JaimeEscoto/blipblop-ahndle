import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { api, User, Doctor, ClinicalRecord, MedicalInfo } from '../api/client';
import { Plus, Pencil, Trash2, Search, ChevronDown, ChevronUp, Heart, FileText, Activity } from 'lucide-react';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import Odontogram from '../components/Odontogram';

const BLOOD_TYPES = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];

export default function Records() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<User[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [search, setSearch] = useState('');
  const [expandedUser, setExpandedUser] = useState<number | null>(null);
  const [records, setRecords] = useState<Record<number, ClinicalRecord[]>>({});
  const [medicalInfos, setMedicalInfos] = useState<Record<number, MedicalInfo | null>>({});
  const [modal, setModal] = useState<{ type: 'record' | 'info'; userId: number; record?: ClinicalRecord } | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'history' | 'info' | 'odontogram'>('history');
  const [openChart, setOpenChart] = useState<number | null>(null);
  const [form, setForm] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [u, d] = await Promise.all([api.users.list(), api.doctors.list()]);
    setUsers(u); setDoctors(d);
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadUserData = async (userId: number) => {
    if (records[userId]) return;
    const [recs, info] = await Promise.all([api.medical.getRecords(userId), api.medical.getInfo(userId)]);
    setRecords(r => ({ ...r, [userId]: recs }));
    setMedicalInfos(m => ({ ...m, [userId]: info }));
  };

  const toggleUser = async (userId: number) => {
    if (expandedUser === userId) { setExpandedUser(null); return; }
    setExpandedUser(userId);
    await loadUserData(userId);
  };

  const openRecord = (userId: number, record?: ClinicalRecord) => {
    setForm(record ? {
      doctor_id: String(record.doctor_id), date: record.date,
      diagnosis: record.diagnosis || '', treatment: record.treatment || '',
      observations: record.observations || '', tooth_chart: record.tooth_chart || {}
    } : {
      doctor_id: '', date: new Date().toISOString().split('T')[0],
      diagnosis: '', treatment: '', observations: '', tooth_chart: {}
    });
    setError(''); setModal({ type: 'record', userId, record });
  };

  const openInfo = (userId: number) => {
    const info = medicalInfos[userId];
    setForm(info ? {
      blood_type: info.blood_type || '', allergies: info.allergies || '',
      medical_conditions: info.medical_conditions || '', current_medications: info.current_medications || '',
      emergency_contact: info.emergency_contact || '', emergency_phone: info.emergency_phone || ''
    } : { blood_type:'', allergies:'', medical_conditions:'', current_medications:'', emergency_contact:'', emergency_phone:'' });
    setError(''); setModal({ type: 'info', userId });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      if (modal?.type === 'info') {
        const info = await api.medical.saveInfo(modal.userId, form);
        setMedicalInfos(m => ({ ...m, [modal.userId]: info }));
      } else {
        const payload = { ...form, user_id: modal!.userId, doctor_id: Number(form.doctor_id) };
        if (modal?.record) {
          const updated = await api.medical.updateRecord(modal.record.id, payload);
          setRecords(r => ({ ...r, [modal.userId]: r[modal.userId].map(x => x.id === updated.id ? updated : x) }));
        } else {
          const created = await api.medical.createRecord(payload);
          setRecords(r => ({ ...r, [modal!.userId]: [created, ...(r[modal!.userId] || [])] }));
        }
      }
      setModal(null);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleDelete = async () => {
    if (!deleteId || !expandedUser) return;
    await api.medical.deleteRecord(deleteId);
    setRecords(r => ({ ...r, [expandedUser]: r[expandedUser].filter(x => x.id !== deleteId) }));
    setDeleteId(null);
  };

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    (u.document_id || '').includes(search)
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('records.title')}</h1>
          <p className="text-sm text-gray-500">{t('records.subtitle')}</p>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={t('records.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="space-y-2">
        {filtered.map(u => (
          <div key={u.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <button className="w-full flex items-center justify-between p-4" onClick={() => toggleUser(u.id)}>
              <div className="text-left">
                <p className="font-semibold text-gray-900">{u.name}</p>
                <p className="text-xs text-gray-400">{u.document_id || u.email}</p>
              </div>
              {expandedUser === u.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>

            {expandedUser === u.id && (
              <div className="border-t border-gray-100 px-4 pb-4">
                {/* Tabs */}
                <div className="flex gap-1 my-3 bg-gray-100 rounded-lg p-1">
                  {(['history','info','odontogram'] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === tab ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>
                      {tab === 'history' ? t('records.tabHistory') : tab === 'info' ? t('records.tabInfo') : t('records.tabOdontogram')}
                    </button>
                  ))}
                </div>

                {activeTab === 'history' && (
                  <div>
                    <button onClick={() => openRecord(u.id)} className="flex items-center gap-1.5 mb-3 text-sm text-blue-600 font-medium hover:underline">
                      <Plus className="w-4 h-4" /> {t('records.newEntry')}
                    </button>
                    {(records[u.id] || []).length === 0
                      ? <p className="text-sm text-gray-400 text-center py-4">{t('records.noHistory')}</p>
                      : (records[u.id] || []).map(r => (
                        <div key={r.id} className="border border-gray-100 rounded-lg p-3 mb-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-xs text-gray-400">{r.date} · Dr. {r.doctor_name}</p>
                              {r.diagnosis && <p className="text-sm font-medium mt-1">{r.diagnosis}</p>}
                              {r.treatment && <p className="text-xs text-gray-500 mt-0.5">{t('records.treatmentLabel', { value: r.treatment })}</p>}
                              {r.observations && <p className="text-xs text-gray-400 mt-0.5 italic">{r.observations}</p>}
                            </div>
                            <div className="flex gap-1">
                              <button onClick={() => openRecord(u.id, r)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Pencil className="w-3.5 h-3.5" /></button>
                              <button onClick={() => setDeleteId(r.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                          {r.tooth_chart && Object.keys(r.tooth_chart).length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-50">
                              <button onClick={() => setOpenChart(openChart === r.id ? null : r.id)}
                                className="flex items-center gap-1.5 text-xs text-blue-600 font-medium hover:underline">
                                <Activity className="w-3.5 h-3.5" />
                                {openChart === r.id ? t('records.hideChart') : t('records.showChart')}
                              </button>
                              {openChart === r.id && (
                                <div className="mt-3">
                                  <Odontogram value={r.tooth_chart} onChange={() => {}} readOnly />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))
                    }
                  </div>
                )}

                {activeTab === 'info' && (
                  <div>
                    <button onClick={() => openInfo(u.id)} className="flex items-center gap-1.5 mb-3 text-sm text-blue-600 font-medium hover:underline">
                      <Pencil className="w-4 h-4" /> {t('records.editMedical')}
                    </button>
                    {medicalInfos[u.id] ? (
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {[
                          [t('records.bloodType'), medicalInfos[u.id]?.blood_type],
                          [t('records.allergies'), medicalInfos[u.id]?.allergies],
                          [t('records.conditionsShort'), medicalInfos[u.id]?.medical_conditions],
                          [t('records.medicationsShort'), medicalInfos[u.id]?.current_medications],
                          [t('records.emergencyContactShort'), medicalInfos[u.id]?.emergency_contact],
                          [t('records.emergencyPhoneShort'), medicalInfos[u.id]?.emergency_phone],
                        ].map(([label, val]) => val ? (
                          <div key={label as string} className="col-span-2 sm:col-span-1">
                            <p className="text-xs text-gray-400">{label}</p>
                            <p className="text-sm text-gray-700">{val}</p>
                          </div>
                        ) : null)}
                      </div>
                    ) : <p className="text-sm text-gray-400 text-center py-4">{t('records.noMedical')}</p>}
                  </div>
                )}

                {activeTab === 'odontogram' && (
                  <div>
                    <p className="text-xs text-gray-400 mb-3">{t('records.lastChart')}</p>
                    {(records[u.id] || []).length > 0
                      ? <Odontogram value={records[u.id][0].tooth_chart || {}} onChange={() => {}} readOnly />
                      : <p className="text-sm text-gray-400 text-center py-4">{t('records.noChart')}</p>
                    }
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {modal && (
        <Modal
          title={modal.type === 'info' ? t('records.infoTitle') : modal.record ? t('records.editEntry') : t('records.newEntryTitle')}
          onClose={() => setModal(null)}
        >
          <form onSubmit={handleSubmit} className="space-y-3">
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

            {modal.type === 'info' ? (
              <>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">{t('records.bloodType')}</label>
                  <select className="input" value={form.blood_type} onChange={e => setForm({...form, blood_type: e.target.value})}>
                    <option value="">{t('common.select')}</option>
                    {BLOOD_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                {[
                  ['allergies', t('records.allergies'), t('records.allergiesPlaceholder')],
                  ['medical_conditions', t('records.conditions'), t('records.conditionsPlaceholder')],
                  ['current_medications', t('records.medications'), t('records.medicationsPlaceholder')],
                  ['emergency_contact', t('records.emergencyContact'), t('records.emergencyContactPlaceholder')],
                  ['emergency_phone', t('records.emergencyPhone'), t('records.emergencyPhonePlaceholder')],
                ].map(([field, label, placeholder]) => (
                  <div key={field}>
                    <label className="text-xs font-medium text-gray-700 mb-1 block">{label}</label>
                    <input className="input" placeholder={placeholder} value={form[field] || ''}
                      onChange={e => setForm({...form, [field]: e.target.value})} />
                  </div>
                ))}
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-700 mb-1 block">{t('records.doctor')} *</label>
                    <select required className="input" value={form.doctor_id} onChange={e => setForm({...form, doctor_id: e.target.value})}>
                      <option value="">{t('common.select')}</option>
                      {doctors.map(d => <option key={d.id} value={d.id}>Dr. {d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700 mb-1 block">{t('records.date')} *</label>
                    <input required type="date" className="input" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">{t('records.diagnosis')}</label>
                  <input className="input" value={form.diagnosis} onChange={e => setForm({...form, diagnosis: e.target.value})} placeholder={t('records.diagnosisPlaceholder')} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">{t('records.treatment')}</label>
                  <input className="input" value={form.treatment} onChange={e => setForm({...form, treatment: e.target.value})} placeholder={t('records.treatmentPlaceholder')} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">{t('records.observations')}</label>
                  <textarea className="input resize-none" rows={2} value={form.observations} onChange={e => setForm({...form, observations: e.target.value})} placeholder={t('records.observationsPlaceholder')} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-2 block">{t('records.tabOdontogram')}</label>
                  <Odontogram value={form.tooth_chart || {}} onChange={tc => setForm({...form, tooth_chart: tc})} />
                </div>
              </>
            )}

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setModal(null)} className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">{t('common.cancel')}</button>
              <button type="submit" disabled={loading} className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
                {loading ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleteId && <ConfirmDialog message={t('records.deleteConfirm')} onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />}
    </div>
  );
}
