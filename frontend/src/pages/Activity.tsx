import { useState, useEffect, useCallback } from 'react';
import { api, ActivityLog, ActivityAccount } from '../api/client';
import {
  Plus, Pencil, Trash2, LogIn, Eye, Activity as ActivityIcon, RefreshCw, ChevronDown, ChevronRight,
} from 'lucide-react';

// Módulos disponibles para filtrar (debe coincidir con las etiquetas del backend).
const ENTITIES = ['Paciente', 'Médico', 'Cita', 'Inventario', 'Recordatorio', 'Invitación', 'Registro clínico', 'Información médica', 'Sesión'];

function actionIcon(action: string) {
  if (action.startsWith('Inició')) return { Icon: LogIn, color: 'text-indigo-600', bg: 'bg-indigo-100' };
  if (action.startsWith('Consultó')) return { Icon: Eye, color: 'text-sky-600', bg: 'bg-sky-100' };
  if (action.startsWith('Creó')) return { Icon: Plus, color: 'text-green-600', bg: 'bg-green-100' };
  if (action.startsWith('Eliminó')) return { Icon: Trash2, color: 'text-red-600', bg: 'bg-red-100' };
  return { Icon: Pencil, color: 'text-amber-600', bg: 'bg-amber-100' };
}

// Traduce las claves técnicas a etiquetas legibles para el detalle.
const FIELD_LABELS: Record<string, string> = {
  name: 'Nombre', email: 'Correo', phone: 'Teléfono', document_id: 'Documento',
  document_type: 'Tipo de documento', birth_date: 'Fecha de nacimiento', gender: 'Género',
  address: 'Dirección', city: 'Ciudad', department: 'Departamento', occupation: 'Ocupación',
  specialty: 'Especialidad', license_number: 'No. de licencia',
  user_id: 'Paciente (id)', doctor_id: 'Médico (id)', appointment_id: 'Cita (id)',
  date: 'Fecha', time: 'Hora', reason: 'Motivo', notes: 'Notas', status: 'Estado',
  diagnosis: 'Diagnóstico', treatment: 'Tratamiento', observations: 'Observaciones',
  blood_type: 'Tipo de sangre', allergies: 'Alergias', medical_conditions: 'Condiciones médicas',
  current_medications: 'Medicamentos actuales', emergency_contact: 'Contacto de emergencia',
  emergency_phone: 'Tel. de emergencia', category: 'Categoría', quantity: 'Cantidad',
  unit: 'Unidad', min_quantity: 'Cantidad mínima', price: 'Precio', supplier: 'Proveedor',
  title: 'Título', description: 'Descripción', type: 'Tipo', tooth_chart: 'Odontograma',
};
const STATUS_LABELS: Record<string, string> = {
  cancelled: 'Cancelada', completed: 'Completada', scheduled: 'Programada',
  done: 'Completado', pending: 'Pendiente',
};

function formatValue(key: string, value: any): string {
  if (value === null || value === undefined || value === '') return '—';
  if (key === 'status') return STATUS_LABELS[value] || String(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export default function Activity() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [accounts, setAccounts] = useState<ActivityAccount[]>([]);
  const [account, setAccount] = useState('');
  const [entity, setEntity] = useState('');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.activity.list({
        account: account || undefined,
        entity: entity || undefined,
      });
      setLogs(data);
    } catch { /* noop */ }
    finally { setLoading(false); }
  }, [account, entity]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.activity.accounts().then(setAccounts).catch(() => {}); }, []);

  const fmt = (d: string) =>
    new Date(d).toLocaleString('es-CO', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Actividad</h1>
          <p className="text-sm text-gray-500">Registro de lo que hace cada usuario en el sistema</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <select className="input sm:max-w-xs" value={account} onChange={e => setAccount(e.target.value)}>
          <option value="">Todos los usuarios</option>
          {accounts.map(a => (
            <option key={a.account_email} value={a.account_email}>
              {a.account_name || a.account_email} ({a.events})
            </option>
          ))}
        </select>
        <select className="input sm:max-w-xs" value={entity} onChange={e => setEntity(e.target.value)}>
          <option value="">Todos los módulos</option>
          {ENTITIES.map(en => <option key={en} value={en}>{en}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        {!loading && logs.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm flex flex-col items-center gap-2">
            <ActivityIcon className="w-8 h-8 text-gray-300" />
            No hay actividad registrada con estos filtros
          </div>
        )}
        {logs.map(log => {
          const { Icon, color, bg } = actionIcon(log.action);
          const hasDetails = log.details && Object.keys(log.details).length > 0;
          const open = expanded === log.id;
          return (
            <div key={log.id} className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <button
                disabled={!hasDetails}
                onClick={() => setExpanded(open ? null : log.id)}
                className="w-full flex items-center gap-3 p-4 text-left disabled:cursor-default"
              >
                <div className={`shrink-0 p-2 rounded-lg ${bg}`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 truncate">
                    <span className="text-blue-700">{log.account_name || log.account_email || 'Desconocido'}</span>
                    {' — '}{log.summary}
                  </p>
                  <p className="text-xs text-gray-400">{fmt(log.created_at)}</p>
                </div>
                {hasDetails && (open
                  ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                  : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />)}
              </button>
              {open && hasDetails && (
                <div className="px-4 pb-4 -mt-1">
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                    <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-2 font-medium">Detalle de la operación</p>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                      {Object.entries(log.details!).map(([k, v]) => (
                        <div key={k} className="flex gap-2 text-sm">
                          <dt className="text-gray-500 shrink-0">{FIELD_LABELS[k] || k}:</dt>
                          <dd className="text-gray-800 font-medium break-words min-w-0">{formatValue(k, v)}</dd>
                        </div>
                      ))}
                    </dl>
                    {log.path && (
                      <p className="text-[11px] text-gray-400 mt-2 pt-2 border-t border-gray-100">
                        {log.method} {log.path}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
