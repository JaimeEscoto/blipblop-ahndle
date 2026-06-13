import { useState, useEffect, useCallback } from 'react';
import { api, Appointment, Doctor, User } from '../api/client';
import { Plus, Pencil, Trash2, Search, Calendar, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';

type Status = 'scheduled' | 'completed' | 'cancelled';

const STATUS_CONFIG: Record<Status, { label: string; icon: typeof CheckCircle; className: string }> = {
  scheduled: { label: 'Programada', icon: AlertCircle, className: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Completada', icon: CheckCircle, className: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelada', icon: XCircle, className: 'bg-red-100 text-red-700' },
};

const TIMES = Array.from({ length: 24 }, (_, h) =>
  ['00', '30'].map(m => `${String(h).padStart(2, '0')}:${m}`)
).flat().filter(t => {
  const h = parseInt(t); return h >= 6 && h <= 20;
});

const EMPTY_FORM = { user_id: '', doctor_id: '', date: '', time: '', reason: '', notes: '', status: 'scheduled' as Status };

export default function Appointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<Status | 'all'>('all');
  const [modal, setModal] = useState<{ type: 'create' | 'edit'; appt?: Appointment } | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const [appts, docs, usrs] = await Promise.all([api.appointments.list(), api.doctors.list(), api.users.list()]);
    setAppointments(appts);
    setDoctors(docs);
    setUsers(usrs);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, date: new Date().toISOString().split('T')[0] });
    setError(''); setModal({ type: 'create' });
  };

  const openEdit = (a: Appointment) => {
    setForm({ user_id: String(a.user_id), doctor_id: String(a.doctor_id), date: a.date, time: a.time, reason: a.reason || '', notes: a.notes || '', status: a.status });
    setError(''); setModal({ type: 'edit', appt: a });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const payload = { user_id: Number(form.user_id), doctor_id: Number(form.doctor_id), date: form.date, time: form.time, reason: form.reason, notes: form.notes, status: form.status };
      if (modal?.type === 'create') await api.appointments.create(payload);
      else await api.appointments.update(modal!.appt!.id, payload);
      await load(); setModal(null);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await api.appointments.delete(deleteId);
    await load(); setDeleteId(null);
  };

  const handleStatusChange = async (id: number, status: Status) => {
    await api.appointments.updateStatus(id, status);
    await load();
  };

  const filtered = appointments.filter(a => {
    const matchSearch = a.user_name.toLowerCase().includes(search.toLowerCase()) ||
      a.doctor_name.toLowerCase().includes(search.toLowerCase()) ||
      (a.reason || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || a.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const formatDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Citas</h1>
          <p className="text-sm text-gray-500">{appointments.length} en total</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Nueva
        </button>
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Buscar paciente, médico o motivo..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Status filter */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {(['all', 'scheduled', 'completed', 'cancelled'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filterStatus === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s === 'all' ? 'Todas' : STATUS_CONFIG[s].label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">No se encontraron citas</div>
        )}
        {filtered.map(a => {
          const cfg = STATUS_CONFIG[a.status];
          const Icon = cfg.icon;
          return (
            <div key={a.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.className}`}>
                      <Icon className="w-3 h-3" />{cfg.label}
                    </span>
                  </div>
                  <p className="font-semibold text-gray-900 truncate">{a.user_name}</p>
                  <p className="text-sm text-gray-600">Dr. {a.doctor_name} · <span className="text-gray-400">{a.doctor_specialty}</span></p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Calendar className="w-3.5 h-3.5" />{formatDate(a.date)}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Clock className="w-3.5 h-3.5" />{a.time}
                    </span>
                  </div>
                  {a.reason && <p className="text-xs text-gray-400 mt-1 truncate">{a.reason}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(a)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => setDeleteId(a.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {/* Quick status actions */}
              {a.status === 'scheduled' && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">
                  <button onClick={() => handleStatusChange(a.id, 'completed')} className="flex-1 text-xs py-1.5 bg-green-50 text-green-700 rounded-lg font-medium hover:bg-green-100">
                    Marcar completada
                  </button>
                  <button onClick={() => handleStatusChange(a.id, 'cancelled')} className="flex-1 text-xs py-1.5 bg-red-50 text-red-700 rounded-lg font-medium hover:bg-red-100">
                    Cancelar cita
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {modal && (
        <Modal title={modal.type === 'create' ? 'Nueva Cita' : 'Editar Cita'} onClose={() => setModal(null)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Paciente *</label>
              <select required className="input" value={form.user_id} onChange={e => setForm({ ...form, user_id: e.target.value })}>
                <option value="">Seleccionar paciente</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Médico *</label>
              <select required className="input" value={form.doctor_id} onChange={e => setForm({ ...form, doctor_id: e.target.value })}>
                <option value="">Seleccionar médico</option>
                {doctors.map(d => <option key={d.id} value={d.id}>Dr. {d.name} — {d.specialty}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Fecha *</label>
                <input required type="date" className="input" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Hora *</label>
                <select required className="input" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })}>
                  <option value="">Hora</option>
                  {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            {modal.type === 'edit' && (
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Estado</label>
                <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Status })}>
                  <option value="scheduled">Programada</option>
                  <option value="completed">Completada</option>
                  <option value="cancelled">Cancelada</option>
                </select>
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Motivo de la consulta</label>
              <input className="input" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Control anual, dolor de cabeza..." />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Notas adicionales</label>
              <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Información adicional..." />
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setModal(null)} className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                Cancelar
              </button>
              <button type="submit" disabled={loading} className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
                {loading ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleteId && (
        <ConfirmDialog
          message="¿Eliminar esta cita? Esta acción no se puede deshacer."
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}
