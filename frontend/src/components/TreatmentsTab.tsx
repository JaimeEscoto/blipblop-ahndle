import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, TreatmentPlan, TreatmentPlanDetail, Doctor, Procedure } from '../api/client';
import { formatMoney } from '../utils/money';
import { withSlug } from '../tenant';
import Modal from './Modal';
import { Plus, Pencil, X, Calendar, Clock, CheckCircle, AlertCircle, XCircle, RotateCcw, Receipt } from 'lucide-react';

interface Props {
  userId: number;
  doctors: Doctor[];
  currency: string;
}

const STATUS_LABEL: Record<TreatmentPlan['status'], { label: string; cls: string }> = {
  active:    { label: 'Activo',    cls: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Finalizado', cls: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelado',  cls: 'bg-red-100 text-red-700' },
};

export default function TreatmentsTab({ userId, doctors, currency }: Props) {
  const [plans, setPlans] = useState<TreatmentPlan[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [detail, setDetail] = useState<TreatmentPlanDetail | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<TreatmentPlanDetail | null>(null);
  const [rescheduling, setRescheduling] = useState<{ plan: TreatmentPlanDetail; sessionNumber: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, procs] = await Promise.all([
        api.treatments.list({ user_id: userId }),
        api.procedures.list(),
      ]);
      setPlans(p);
      setProcedures(procs);
    } finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (planId: number) => {
    if (expanded === planId) { setExpanded(null); setDetail(null); return; }
    setExpanded(planId);
    const d = await api.treatments.get(planId);
    setDetail(d);
  };

  const refreshDetail = async () => {
    if (!detail) return;
    const d = await api.treatments.get(detail.id);
    setDetail(d);
    await load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-500">{loading ? 'Cargando…' : `${plans.length} plan${plans.length === 1 ? '' : 'es'}`}</p>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 text-sm text-blue-600 font-medium hover:underline"
        >
          <Plus className="w-4 h-4" /> Nuevo plan
        </button>
      </div>

      {plans.length === 0 && !loading && (
        <p className="text-sm text-gray-400 text-center py-4">
          Este paciente no tiene planes de tratamiento. Crea uno para procedimientos multi-sesión (ortodoncia, endodoncia, etc.).
        </p>
      )}

      <div className="space-y-2">
        {plans.map(p => {
          const progressPct = p.sessions_planned > 0
            ? Math.round((p.sessions_completed / p.sessions_planned) * 100) : 0;
          const isOpen = expanded === p.id;
          return (
            <div key={p.id} className="border border-gray-100 rounded-lg overflow-hidden">
              <button
                onClick={() => openDetail(p.id)}
                className="w-full p-3 text-left hover:bg-gray-50 flex items-start gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-900 truncate">{p.procedure_name}</p>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${STATUS_LABEL[p.status].cls}`}>
                      {STATUS_LABEL[p.status].label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Dr. {p.doctor_name} · {p.sessions_completed} de {p.sessions_planned} sesiones
                  </p>
                  <div className="h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-blue-500 transition-all" style={{ width: `${progressPct}%` }} />
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-gray-900">{formatMoney(p.total_amount, currency)}</p>
                  <p className="text-[10px] text-gray-400">{formatMoney(p.per_session_amount, currency)}/sesión</p>
                </div>
              </button>

              {isOpen && detail?.id === p.id && (
                <PlanDetailBody
                  plan={detail}
                  currency={currency}
                  onEdit={() => setEditing(detail)}
                  onReschedule={(sn) => setRescheduling({ plan: detail, sessionNumber: sn })}
                  onCancelPlan={async () => {
                    if (!confirm('¿Cancelar este plan de tratamiento? Las citas pendientes quedarán huérfanas.')) return;
                    await api.treatments.setStatus(detail.id, 'cancelled');
                    await load();
                    setExpanded(null);
                    setDetail(null);
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {createOpen && (
        <CreatePlanModal
          userId={userId}
          doctors={doctors}
          procedures={procedures}
          currency={currency}
          onClose={() => setCreateOpen(false)}
          onCreated={async () => { setCreateOpen(false); await load(); }}
        />
      )}

      {editing && (
        <EditPlanModal
          plan={editing}
          currency={currency}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await refreshDetail(); }}
        />
      )}

      {rescheduling && (
        <RescheduleSessionModal
          plan={rescheduling.plan}
          sessionNumber={rescheduling.sessionNumber}
          onClose={() => setRescheduling(null)}
          onSaved={async () => { setRescheduling(null); await refreshDetail(); }}
        />
      )}
    </div>
  );
}

// ── Detalle de un plan: sesiones + acciones ──────────────────────────
function PlanDetailBody({
  plan, currency, onEdit, onReschedule, onCancelPlan,
}: {
  plan: TreatmentPlanDetail; currency: string;
  onEdit: () => void;
  onReschedule: (sessionNumber: number) => void;
  onCancelPlan: () => void;
}) {
  const navigate = useNavigate();
  return (
    <div className="border-t border-gray-100 p-3 bg-gray-50">
      <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
        <div className="bg-white rounded-lg p-2">
          <p className="text-gray-400">Total</p>
          <p className="font-semibold text-gray-900">{formatMoney(plan.total_amount, currency)}</p>
        </div>
        <div className="bg-white rounded-lg p-2">
          <p className="text-gray-400">Por sesión</p>
          <p className="font-semibold text-gray-900">{formatMoney(plan.per_session_amount, currency)}</p>
        </div>
        <div className="bg-white rounded-lg p-2">
          <p className="text-gray-400">Progreso</p>
          <p className="font-semibold text-gray-900">
            {plan.sessions_completed}/{plan.sessions_planned}
          </p>
        </div>
      </div>

      {plan.notes && (
        <p className="text-[11px] text-gray-500 italic mb-3">{plan.notes}</p>
      )}

      <p className="text-xs font-semibold text-gray-700 mb-2">Sesiones</p>
      <div className="space-y-1.5 mb-3">
        {plan.appointments.map(a => {
          const Icon = a.status === 'completed' ? CheckCircle
            : a.status === 'cancelled' ? XCircle : AlertCircle;
          const color = a.status === 'completed' ? 'text-green-600'
            : a.status === 'cancelled' ? 'text-red-500' : 'text-blue-600';
          return (
            <div key={a.id} className="flex items-center gap-2 bg-white rounded-lg px-2 py-1.5 text-xs">
              <Icon className={`w-4 h-4 shrink-0 ${color}`} />
              <span className="font-semibold text-gray-700 shrink-0 w-12">#{a.session_number}</span>
              <span className="flex items-center gap-1 text-gray-500"><Calendar className="w-3 h-3" />{a.date}</span>
              <span className="flex items-center gap-1 text-gray-500"><Clock className="w-3 h-3" />{a.time}</span>
              <div className="flex-1" />
              {a.status !== 'completed' && plan.status === 'active' && (
                <button
                  onClick={() => onReschedule(a.session_number)}
                  className="text-blue-600 hover:underline text-[11px] font-medium flex items-center gap-1"
                  title="Reprogramar esta sesión"
                >
                  <RotateCcw className="w-3 h-3" /> Reprogramar
                </button>
              )}
              {a.status === 'completed' && (
                <button
                  onClick={() => navigate(`${withSlug('/finanzas')}?invoice=auto&appt=${a.id}`)}
                  className="text-gray-400 hover:text-blue-600"
                  title="Ver factura de esta sesión"
                >
                  <Receipt className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {plan.status === 'active' && (
        <div className="flex gap-2">
          <button onClick={onEdit} className="flex-1 py-2 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 flex items-center justify-center gap-1.5">
            <Pencil className="w-3.5 h-3.5" /> Editar plan
          </button>
          <button onClick={onCancelPlan} className="flex-1 py-2 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100">
            Cancelar plan
          </button>
        </div>
      )}
    </div>
  );
}

// ── Crear plan: modal ───────────────────────────────────────────────
function CreatePlanModal({
  userId, doctors, procedures, currency, onClose, onCreated,
}: {
  userId: number; doctors: Doctor[]; procedures: Procedure[]; currency: string;
  onClose: () => void; onCreated: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [procedureId, setProcedureId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [sessions, setSessions] = useState('1');
  const [total, setTotal] = useState('0');
  const [startDate, setStartDate] = useState(today);
  const [time, setTime] = useState('10:00');
  const [intervalWeeks, setIntervalWeeks] = useState('4');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Al elegir procedimiento prellenar sesiones y total con los defaults del catálogo.
  const onProcedure = (id: string) => {
    setProcedureId(id);
    const p = procedures.find(x => x.id === Number(id));
    if (p) {
      const ses = p.default_sessions || 1;
      setSessions(String(ses));
      setTotal(String(Number(p.default_price) * ses));
    }
  };

  const sessionsN = Math.max(1, Number(sessions) || 1);
  const totalN = Math.max(0, Number(total) || 0);
  const perSession = sessionsN > 0 ? totalN / sessionsN : 0;

  // Preview de las fechas (primeras 5 + última si hay más)
  const previewDates: string[] = [];
  if (startDate) {
    const baseTime = new Date(`${startDate}T00:00:00`).getTime();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const limit = Math.min(sessionsN, 5);
    for (let i = 0; i < limit; i++) {
      const d = new Date(baseTime + i * Number(intervalWeeks) * weekMs);
      previewDates.push(d.toISOString().slice(0, 10));
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (!procedureId || !doctorId) { setError('Selecciona procedimiento y doctor'); return; }
    if (!startDate || !time) { setError('Fecha y hora son requeridas'); return; }
    setLoading(true);
    try {
      await api.treatments.create({
        user_id: userId,
        doctor_id: Number(doctorId),
        procedure_id: Number(procedureId),
        total_amount: totalN,
        sessions_planned: sessionsN,
        start_date: startDate,
        time,
        interval_weeks: Math.max(0, Number(intervalWeeks) || 0),
        notes: notes.trim() || undefined,
      });
      onCreated();
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal title="Nuevo plan de tratamiento" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">Procedimiento *</label>
          <select required className="input" value={procedureId} onChange={e => onProcedure(e.target.value)}>
            <option value="">Seleccionar…</option>
            {procedures.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}{(p.default_sessions || 1) > 1 ? ` (${p.default_sessions} sesiones)` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">Doctor *</label>
          <select required className="input" value={doctorId} onChange={e => setDoctorId(e.target.value)}>
            <option value="">Seleccionar…</option>
            {doctors.map(d => <option key={d.id} value={d.id}>Dr. {d.name} — {d.specialty}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Total *</label>
            <input required type="number" min="0" step="0.01" className="input"
              value={total} onChange={e => setTotal(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Sesiones *</label>
            <input required type="number" min="1" step="1" className="input"
              value={sessions} onChange={e => setSessions(e.target.value)} />
          </div>
        </div>

        <div className="bg-indigo-50 rounded-lg px-3 py-2 text-xs text-indigo-800">
          <strong>{formatMoney(perSession, currency)}</strong> por sesión
          {sessionsN > 1 && <> · {sessionsN} cuotas</>}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Fecha 1ª sesión *</label>
            <input required type="date" min={today} className="input"
              value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Hora *</label>
            <input required type="time" className="input"
              value={time} onChange={e => setTime(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block" title="Cada cuántas semanas entre sesiones">Cada (sem)</label>
            <input type="number" min="0" step="1" className="input"
              value={intervalWeeks} onChange={e => setIntervalWeeks(e.target.value)} />
          </div>
        </div>

        {previewDates.length > 0 && (
          <div className="text-xs text-gray-500">
            <p className="font-semibold text-gray-600 mb-1">Vista previa</p>
            <div className="flex flex-wrap gap-1.5">
              {previewDates.map((d, i) => (
                <span key={i} className="bg-gray-100 px-2 py-0.5 rounded">#{i + 1} · {d}</span>
              ))}
              {sessionsN > 5 && <span className="text-gray-400">… +{sessionsN - 5} más</span>}
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              Podrás reprogramar cualquier sesión después de crear el plan.
            </p>
          </div>
        )}

        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">Notas</label>
          <textarea className="input resize-none" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancelar</button>
          <button type="submit" disabled={loading} className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
            {loading ? 'Creando…' : 'Crear plan'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Editar plan: solo total, sesiones y notas ────────────────────────
function EditPlanModal({ plan, currency, onClose, onSaved }: {
  plan: TreatmentPlanDetail; currency: string;
  onClose: () => void; onSaved: () => void;
}) {
  const [total, setTotal] = useState(String(plan.total_amount));
  const [sessions, setSessions] = useState(String(plan.sessions_planned));
  const [notes, setNotes] = useState(plan.notes || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const sessionsN = Math.max(1, Number(sessions) || 1);
  const totalN = Math.max(0, Number(total) || 0);
  const perSession = sessionsN > 0 ? totalN / sessionsN : 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (sessionsN < plan.sessions_completed) {
      setError(`Ya hay ${plan.sessions_completed} sesiones completadas; no puedes bajar a menos.`);
      return;
    }
    setLoading(true);
    try {
      await api.treatments.update(plan.id, {
        total_amount: totalN,
        sessions_planned: sessionsN,
        notes: notes.trim() || undefined,
      });
      onSaved();
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal title="Editar plan" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <p className="text-[11px] text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
          El cambio de precio por sesión afecta solo a las sesiones <strong>futuras</strong>. Las facturas ya creadas no cambian.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Total</label>
            <input type="number" min="0" step="0.01" className="input"
              value={total} onChange={e => setTotal(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Sesiones</label>
            <input type="number" min={plan.sessions_completed || 1} step="1" className="input"
              value={sessions} onChange={e => setSessions(e.target.value)} />
            <p className="text-[10px] text-gray-400 mt-1">{plan.sessions_completed} ya completadas</p>
          </div>
        </div>
        <div className="bg-indigo-50 rounded-lg px-3 py-2 text-xs text-indigo-800">
          Nuevo precio por sesión: <strong>{formatMoney(perSession, currency)}</strong>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">Notas</label>
          <textarea className="input resize-none" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancelar</button>
          <button type="submit" disabled={loading} className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
            {loading ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Reprogramar sesión ──────────────────────────────────────────────
function RescheduleSessionModal({ plan, sessionNumber, onClose, onSaved }: {
  plan: TreatmentPlanDetail; sessionNumber: number;
  onClose: () => void; onSaved: () => void;
}) {
  const original = plan.appointments.find(a => a.session_number === sessionNumber)!;
  const [date, setDate] = useState(original.date);
  const [time, setTime] = useState(original.time);
  const [cascade, setCascade] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Cuántas sesiones siguientes (no completadas) se moverían si cascade
  const followingMovable = plan.appointments.filter(
    a => a.session_number > sessionNumber && a.status !== 'completed',
  ).length;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      await api.treatments.reschedule(plan.id, sessionNumber, {
        date, time, cascade_following: cascade,
      });
      onSaved();
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal title={`Reprogramar sesión #${sessionNumber}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-600">
          Fecha actual: <strong>{original.date}</strong> a las <strong>{original.time}</strong>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Nueva fecha</label>
            <input required type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Hora</label>
            <input required type="time" className="input" value={time} onChange={e => setTime(e.target.value)} />
          </div>
        </div>
        {followingMovable > 0 && (
          <label className="flex items-start gap-2 cursor-pointer bg-blue-50 rounded-lg px-3 py-2">
            <input
              type="checkbox"
              checked={cascade}
              onChange={e => setCascade(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-xs text-blue-900">
              Mover también las {followingMovable} sesiones siguientes el mismo número de días.
            </span>
          </label>
        )}
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancelar</button>
          <button type="submit" disabled={loading} className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
            {loading ? 'Guardando…' : 'Reprogramar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
