import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, User, Appointment, Invoice } from '../api/client';
import { withSlug } from '../tenant';
import { Search, User as UserIcon, Calendar, Receipt, X } from 'lucide-react';

interface Props {
  // Modo pantalla completa (móvil): el buscador ocupa toda la vista, no un dropdown flotante.
  fullScreen?: boolean;
  onClose?: () => void;
}

export default function GlobalSearch({ fullScreen, onClose }: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (fullScreen) inputRef.current?.focus(); }, [fullScreen]);

  // Carga las 3 listas una sola vez, la primera vez que el usuario usa el buscador
  // (mismo patrón que ya usan Pacientes/Citas/Finanzas: todo se filtra en el cliente).
  const ensureLoaded = () => {
    if (loaded) return;
    setLoaded(true);
    Promise.all([api.users.list(), api.appointments.list(), api.invoices.list({ limit: 300 })])
      .then(([u, a, i]) => { setUsers(u); setAppointments(a); setInvoices(i); })
      .catch(() => {});
  };

  const reset = () => { setQuery(''); setFocused(false); onClose?.(); };

  // Sin acentos ni mayúsculas: para que "maria" encuentre "María" y viceversa.
  const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  const q = fold(query.trim());
  const active = q.length >= 2;
  const matchedUsers = active ? users.filter(u =>
    fold(u.name).includes(q) || fold(u.email || '').includes(q) ||
    (u.phone || '').includes(q) || (u.document_id || '').includes(q)
  ).slice(0, 5) : [];
  const matchedAppointments = active ? appointments.filter(a =>
    fold(a.user_name).includes(q) || fold(a.doctor_name).includes(q) || fold(a.reason || '').includes(q)
  ).slice(0, 5) : [];
  const matchedInvoices = active ? invoices.filter(i =>
    String(i.number).padStart(4, '0').includes(q) || fold(i.user_name).includes(q)
  ).slice(0, 5) : [];
  const hasResults = matchedUsers.length + matchedAppointments.length + matchedInvoices.length > 0;

  const goUser = (id: number) => { navigate(withSlug(`/pacientes?user=${id}`)); reset(); };
  const goInvoice = (id: number) => { navigate(withSlug(`/finanzas?invoice=${id}`)); reset(); };
  const goAppointments = (text: string) => { navigate(withSlug(`/citas?q=${encodeURIComponent(text)}`)); reset(); };

  const Results = () => (
    <div className="py-1">
      {active && !hasResults && (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">Sin resultados para "{query}".</p>
      )}
      {matchedUsers.length > 0 && (
        <div className="mb-1">
          <p className="px-3 py-1 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Pacientes</p>
          {matchedUsers.map(u => (
            <button key={u.id} onMouseDown={() => goUser(u.id)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-blue-50 dark:hover:bg-gray-700 rounded-lg">
              <UserIcon className="w-4 h-4 text-blue-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{u.name}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{u.document_id || u.phone || u.email || '—'}</p>
              </div>
            </button>
          ))}
        </div>
      )}
      {matchedAppointments.length > 0 && (
        <div className="mb-1">
          <p className="px-3 py-1 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Citas</p>
          {matchedAppointments.map(a => (
            <button key={a.id} onMouseDown={() => goAppointments(a.user_name)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-blue-50 dark:hover:bg-gray-700 rounded-lg">
              <Calendar className="w-4 h-4 text-indigo-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{a.user_name}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{a.date} {a.time} · Dr. {a.doctor_name}</p>
              </div>
            </button>
          ))}
        </div>
      )}
      {matchedInvoices.length > 0 && (
        <div>
          <p className="px-3 py-1 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Facturas</p>
          {matchedInvoices.map(i => (
            <button key={i.id} onMouseDown={() => goInvoice(i.id)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-blue-50 dark:hover:bg-gray-700 rounded-lg">
              <Receipt className="w-4 h-4 text-green-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">#{String(i.number).padStart(4, '0')} · {i.user_name}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{i.date}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            className="flex-1 text-sm outline-none bg-transparent text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            placeholder="Buscar paciente, cita o factura…"
            value={query}
            onFocus={ensureLoaded}
            onChange={e => setQuery(e.target.value)}
          />
          <button onClick={onClose} className="shrink-0 p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-1 py-1">
          <Results />
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-200" />
        <input
          className="w-full pl-9 pr-3 py-2 rounded-lg text-sm bg-blue-800/60 text-white placeholder-blue-200 border border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white focus:text-gray-800 focus:placeholder-gray-400"
          placeholder="Buscar paciente, cita o factura…"
          value={query}
          onFocus={() => { ensureLoaded(); setFocused(true); }}
          onBlur={() => setTimeout(() => setFocused(false), 100)}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') { (e.target as HTMLInputElement).blur(); reset(); } }}
        />
      </div>
      {focused && active && (
        <div className="absolute left-0 right-0 mt-1.5 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 max-h-96 overflow-y-auto z-10">
          <Results />
        </div>
      )}
    </div>
  );
}
