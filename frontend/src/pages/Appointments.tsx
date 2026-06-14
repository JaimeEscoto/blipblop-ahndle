import { useState, useEffect, useCallback } from 'react';
import { api, Appointment, Doctor, User } from '../api/client';
import { Plus, Pencil, Trash2, Search, Calendar, Clock, CheckCircle, XCircle, AlertCircle, Download, List, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { generateAppointmentPDF } from '../utils/generateAppointmentPDF';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import Odontogram from '../components/Odontogram';

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
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [modal, setModal] = useState<{ type: 'create' | 'edit'; appt?: Appointment } | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Modal de completar cita → entrada clínica con odontograma
  const [completeAppt, setCompleteAppt] = useState<Appointment | null>(null);
  const [completeForm, setCompleteForm] = useState({ diagnosis: '', treatment: '', observations: '', tooth_chart: {} as Record<string, string> });
  const [loadingChart, setLoadingChart] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState('');

  const load = useCallback(async () => {
    const [appts, docs, usrs] = await Promise.all([api.appointments.list(), api.doctors.list(), api.users.list()]);
    setAppointments(appts);
    setDoctors(docs);
    setUsers(usrs);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    const d = new Date();
    const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    setForm({ ...EMPTY_FORM, date: local });
    setError(''); setModal({ type: 'create' });
  };

  const openEdit = (a: Appointment) => {
    setForm({ user_id: String(a.user_id), doctor_id: String(a.doctor_id), date: a.date, time: a.time, reason: a.reason || '', notes: a.notes || '', status: a.status });
    setError(''); setModal({ type: 'edit', appt: a });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Completar requiere entrada al historial: redirigir al flujo guiado
    if (modal?.type === 'edit' && form.status === 'completed' && modal.appt!.status !== 'completed') {
      setError('');
      const appt = modal.appt!;
      setModal(null);
      await openComplete(appt);
      return;
    }
    // No permitir agendar en el pasado (al crear o al reprogramar la fecha/hora)
    const changedDateTime = modal?.type === 'create' || form.date !== modal?.appt?.date || form.time !== modal?.appt?.time;
    if (changedDateTime && form.date && form.time) {
      const when = new Date(`${form.date}T${form.time}`);
      if (when.getTime() < Date.now()) {
        setError('No se pueden agendar citas en una fecha u hora pasada.');
        return;
      }
    }
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

  // Abrir modal de completar: carga el odontograma previo del paciente
  const openComplete = async (a: Appointment) => {
    setCompleteAppt(a);
    setCompleteForm({ diagnosis: a.reason || '', treatment: '', observations: '', tooth_chart: {} });
    setCompleteError('');
    setLoadingChart(true);
    try {
      const recs = await api.medical.getRecords(a.user_id);
      // El registro más reciente trae el odontograma "como estaba antes"
      const lastChart = recs.length > 0 ? (recs[0].tooth_chart || {}) : {};
      setCompleteForm(f => ({ ...f, tooth_chart: { ...lastChart } }));
    } catch {
      // si falla la carga, se parte de un odontograma vacío
    } finally {
      setLoadingChart(false);
    }
  };

  // Guardar entrada clínica y recién entonces finalizar la cita
  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completeAppt) return;
    setCompleteError(''); setCompleting(true);
    try {
      await api.medical.createRecord({
        user_id: completeAppt.user_id,
        doctor_id: completeAppt.doctor_id,
        appointment_id: completeAppt.id,
        date: new Date().toISOString().split('T')[0],
        diagnosis: completeForm.diagnosis,
        treatment: completeForm.treatment,
        observations: completeForm.observations,
        tooth_chart: completeForm.tooth_chart,
      });
      await api.appointments.updateStatus(completeAppt.id, 'completed');
      await load();
      setCompleteAppt(null);
    } catch (err: any) {
      setCompleteError(err.message);
    } finally {
      setCompleting(false);
    }
  };

  const filtered = appointments.filter(a => {
    const matchSearch = a.user_name.toLowerCase().includes(search.toLowerCase()) ||
      a.doctor_name.toLowerCase().includes(search.toLowerCase()) ||
      (a.reason || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || a.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const formatDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });

  // ── Tarjeta de cita reutilizable (lista y calendario) ──
  const ApptCard = (a: Appointment) => {
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
            <button onClick={() => generateAppointmentPDF(a)} className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg" title="Descargar PDF">
              <Download className="w-4 h-4" />
            </button>
            <button onClick={() => openEdit(a)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
              <Pencil className="w-4 h-4" />
            </button>
            <button onClick={() => setDeleteId(a.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        {a.status === 'scheduled' && (
          <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">
            <button onClick={() => openComplete(a)} className="flex-1 text-xs py-1.5 bg-green-50 text-green-700 rounded-lg font-medium hover:bg-green-100">
              Marcar completada
            </button>
            <button onClick={() => handleStatusChange(a.id, 'cancelled')} className="flex-1 text-xs py-1.5 bg-red-50 text-red-700 rounded-lg font-medium hover:bg-red-100">
              Cancelar cita
            </button>
          </div>
        )}
      </div>
    );
  };

  // ── Lógica del calendario mensual ──
  const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const monthLabel = capFirst(calMonth.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }));
  const todayStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();

  // Citas (filtradas por estado) agrupadas por fecha YYYY-MM-DD
  const byDate = appointments.reduce<Record<string, Appointment[]>>((acc, a) => {
    if (filterStatus !== 'all' && a.status !== filterStatus) return acc;
    (acc[a.date] = acc[a.date] || []).push(a);
    return acc;
  }, {});

  // Celdas del mes: arranca en lunes
  const buildCalendarCells = () => {
    const year = calMonth.getFullYear(), month = calMonth.getMonth();
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7; // lunes = 0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  };

  const changeMonth = (delta: number) => {
    setSelectedDate(null);
    setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  };

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

      {/* Selector de vista */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        <button onClick={() => setView('list')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${view === 'list' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>
          <List className="w-4 h-4" /> Lista
        </button>
        <button onClick={() => setView('calendar')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${view === 'calendar' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>
          <CalendarDays className="w-4 h-4" /> Calendario
        </button>
      </div>

      {view === 'list' && (
        <>
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
            {filtered.map(a => ApptCard(a))}
          </div>
        </>
      )}

      {view === 'calendar' && (
        <div>
          {/* Cabecera del mes */}
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => changeMonth(-1)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"><ChevronLeft className="w-5 h-5" /></button>
            <span className="font-semibold text-gray-900">{monthLabel}</span>
            <button onClick={() => changeMonth(1)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"><ChevronRight className="w-5 h-5" /></button>
          </div>

          {/* Filtro de estado también en calendario */}
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
            {(['all', 'scheduled', 'completed', 'cancelled'] as const).map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filterStatus === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {s === 'all' ? 'Todas' : STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>

          {/* Cuadrícula */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-2">
            <div className="grid grid-cols-7 mb-1">
              {WEEKDAYS.map(d => <div key={d} className="text-center text-[11px] font-medium text-gray-400 py-1">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {buildCalendarCells().map((cell, i) => {
                if (!cell) return <div key={`e${i}`} className="min-h-[80px]" />;
                const day = Number(cell.split('-')[2]);
                const dayAppts = [...(byDate[cell] || [])].sort((a, b) => a.time.localeCompare(b.time));
                const isToday = cell === todayStr;
                const isSelected = cell === selectedDate;
                const chipCls: Record<Status, string> = {
                  scheduled: 'bg-blue-50 border-blue-500 text-blue-900',
                  completed: 'bg-green-50 border-green-500 text-green-900',
                  cancelled: 'bg-red-50 border-red-400 text-red-700',
                };
                return (
                  <button key={cell} onClick={() => setSelectedDate(isSelected ? null : cell)}
                    className={`min-h-[96px] rounded-lg border flex flex-col items-stretch p-1 text-left transition-colors overflow-hidden ${
                      isSelected ? 'border-blue-500 bg-blue-50' : isToday ? 'border-blue-200 bg-blue-50/40' : 'border-gray-100 hover:bg-gray-50'
                    }`}>
                    <span className={`text-xs mb-0.5 ${isToday ? 'font-bold text-blue-600' : 'text-gray-500'}`}>{day}</span>
                    <div className="flex flex-col gap-0.5">
                      {dayAppts.slice(0, 3).map(a => (
                        <div key={a.id} className={`rounded border-l-2 px-1 py-0.5 leading-tight ${chipCls[a.status]}`}
                          title={`${a.time} · ${a.user_name} · Dr. ${a.doctor_name} (${a.doctor_specialty})${a.reason ? ' · ' + a.reason : ''}`}>
                          <p className="text-[9px] font-semibold truncate">
                            {a.time} {a.user_name}{a.status === 'cancelled' && ' ✕'}
                          </p>
                          <p className="text-[8px] opacity-70 truncate">Dr. {a.doctor_name}</p>
                        </div>
                      ))}
                      {dayAppts.length > 3 && <span className="text-[9px] text-gray-400 px-1">+{dayAppts.length - 3} más</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Leyenda */}
          <div className="flex gap-3 mt-2 mb-4 text-[11px] text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" />Programada</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />Completada</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" />Cancelada</span>
          </div>

          {/* Citas del día seleccionado */}
          {selectedDate && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">
                {capFirst(new Date(selectedDate + 'T00:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }))}
              </p>
              <div className="space-y-3">
                {(byDate[selectedDate] || []).length === 0
                  ? <div className="text-center py-8 text-gray-400 text-sm">Sin citas este día</div>
                  : [...(byDate[selectedDate] || [])].sort((a, b) => a.time.localeCompare(b.time)).map(a => ApptCard(a))
                }
              </div>
            </div>
          )}
        </div>
      )}

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
                <input required type="date" min={modal?.type === 'create' ? todayStr : undefined} className="input" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
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

      {completeAppt && (
        <Modal title="Completar cita — entrada al historial" onClose={() => setCompleteAppt(null)}>
          <form onSubmit={handleComplete} className="space-y-3">
            {completeError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{completeError}</p>}

            <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm">
              <p className="font-semibold text-gray-900">{completeAppt.user_name}</p>
              <p className="text-xs text-gray-500">Dr. {completeAppt.doctor_name} · {completeAppt.doctor_specialty}</p>
            </div>

            <p className="text-xs text-gray-500">
              Para finalizar la cita debes registrar una entrada en el historial del paciente.
            </p>

            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Diagnóstico</label>
              <input className="input" value={completeForm.diagnosis} onChange={e => setCompleteForm({ ...completeForm, diagnosis: e.target.value })} placeholder="Caries en molar superior..." />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Tratamiento realizado</label>
              <input className="input" value={completeForm.treatment} onChange={e => setCompleteForm({ ...completeForm, treatment: e.target.value })} placeholder="Obturación con resina compuesta..." />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Observaciones</label>
              <textarea className="input resize-none" rows={2} value={completeForm.observations} onChange={e => setCompleteForm({ ...completeForm, observations: e.target.value })} placeholder="Próxima cita en 6 meses..." />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 mb-2 block">Odontograma</label>
              <p className="text-[11px] text-gray-400 mb-2">
                Cargado como estaba en el último registro. Ajusta lo que cambió en esta cita; se guardará como un nuevo registro del historial.
              </p>
              {loadingChart
                ? <p className="text-sm text-gray-400 text-center py-4">Cargando odontograma...</p>
                : <Odontogram value={completeForm.tooth_chart} onChange={tc => setCompleteForm({ ...completeForm, tooth_chart: tc })} />
              }
            </div>

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setCompleteAppt(null)} className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                Cancelar
              </button>
              <button type="submit" disabled={completing || loadingChart} className="flex-1 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-60">
                {completing ? 'Guardando...' : 'Guardar y completar'}
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
