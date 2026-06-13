import { useState, useEffect, useCallback } from 'react';
import { api, Reminder, User } from '../api/client';
import { Plus, Trash2, Check, Bell, UserIcon, MessageCircle } from 'lucide-react';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';

const TIMES = Array.from({ length: 29 }, (_, i) => {
  const h = Math.floor(i / 2) + 6;
  const m = i % 2 === 0 ? '00' : '30';
  return `${String(h).padStart(2,'0')}:${m}`;
});

export default function Reminders() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [tab, setTab] = useState<'pending'|'done'>('pending');
  const [modal, setModal] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({ title:'', description:'', date: new Date().toISOString().split('T')[0], time:'', type:'task', user_id:'' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [r, u] = await Promise.all([api.reminders.list(), api.users.list()]);
    setReminders(r); setUsers(u);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      await api.reminders.create({ ...form, user_id: form.user_id ? Number(form.user_id) : null, time: form.time || null });
      await load(); setModal(false);
      setForm({ title:'', description:'', date: new Date().toISOString().split('T')[0], time:'', type:'task', user_id:'' });
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleDone = async (id: number) => {
    await api.reminders.updateStatus(id, 'done');
    await load();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await api.reminders.delete(deleteId);
    await load(); setDeleteId(null);
  };

  const waLink = (reminder: Reminder) => {
    if (!reminder.user_phone) return null;
    const phone = reminder.user_phone.replace(/\D/g, '');
    const msg = encodeURIComponent(
      `Hola ${reminder.user_name}, le recordamos su cita odontológica el día ${reminder.date}${reminder.time ? ` a las ${reminder.time}` : ''}. Por favor confirme su asistencia. ¡Gracias!`
    );
    return `https://wa.me/${phone}?text=${msg}`;
  };

  const filtered = reminders.filter(r => r.status === tab);
  const pendingCount = reminders.filter(r => r.status === 'pending').length;

  const formatDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { weekday:'short', day:'numeric', month:'short' });

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Recordatorios</h1>
          <p className="text-sm text-gray-500">{pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setModal(true)} className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Nuevo
        </button>
      </div>

      <div className="flex gap-2 mb-4 bg-gray-100 rounded-lg p-1">
        {(['pending','done'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${tab === t ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>
            {t === 'pending' ? `Pendientes ${pendingCount > 0 ? `(${pendingCount})` : ''}` : 'Completados'}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && <div className="text-center py-12 text-gray-400 text-sm">No hay recordatorios {tab === 'pending' ? 'pendientes' : 'completados'}</div>}
        {filtered.map(r => {
          const link = waLink(r);
          return (
            <div key={r.id} className={`bg-white rounded-xl border shadow-sm p-4 ${r.status === 'done' ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={`mt-0.5 shrink-0 p-1.5 rounded-lg ${r.type === 'patient' ? 'bg-green-100' : 'bg-blue-100'}`}>
                    {r.type === 'patient' ? <UserIcon className="w-4 h-4 text-green-600" /> : <Bell className="w-4 h-4 text-blue-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{r.title}</p>
                    {r.user_name && <p className="text-xs text-gray-500">Paciente: {r.user_name}</p>}
                    {r.description && <p className="text-xs text-gray-400 mt-0.5">{r.description}</p>}
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs text-gray-400">{formatDate(r.date)}{r.time ? ` · ${r.time}` : ''}</span>
                    </div>
                    {/* WhatsApp button */}
                    {link && r.status === 'pending' && (
                      <a href={link} target="_blank" rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1.5 text-xs text-green-700 bg-green-50 px-2.5 py-1 rounded-lg hover:bg-green-100 font-medium">
                        <MessageCircle className="w-3.5 h-3.5" />
                        Enviar recordatorio por WhatsApp
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  {r.status === 'pending' && (
                    <button onClick={() => handleDone(r.id)} className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg" title="Marcar como hecho">
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => setDeleteId(r.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {modal && (
        <Modal title="Nuevo recordatorio" onClose={() => setModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Tipo</label>
              <div className="grid grid-cols-2 gap-2">
                {[['task','Tarea interna','Bell'],['patient','Recordatorio a paciente','UserIcon']].map(([val, label]) => (
                  <button key={val} type="button" onClick={() => setForm({...form, type: val, user_id: val === 'task' ? '' : form.user_id})}
                    className={`p-3 rounded-lg border text-sm font-medium text-left transition-colors ${form.type === val ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {form.type === 'patient' && (
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Paciente</label>
                <select className="input" value={form.user_id} onChange={e => setForm({...form, user_id: e.target.value})}>
                  <option value="">Seleccionar paciente</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Título *</label>
              <input required className="input" value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="Recordar cita de control..." />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Descripción</label>
              <textarea className="input resize-none" rows={2} value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Detalles adicionales..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Fecha *</label>
                <input required type="date" className="input" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Hora</label>
                <select className="input" value={form.time} onChange={e => setForm({...form, time: e.target.value})}>
                  <option value="">Sin hora</option>
                  {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setModal(false)} className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancelar</button>
              <button type="submit" disabled={loading} className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
                {loading ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleteId && <ConfirmDialog message="¿Eliminar este recordatorio?" onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />}
    </div>
  );
}
