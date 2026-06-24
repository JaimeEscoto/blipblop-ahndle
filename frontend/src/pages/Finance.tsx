import { useState, useEffect, useCallback } from 'react';
import { api, Procedure, Invoice, InvoiceDetail, FinanceSettings, FinanceReport, Doctor, Appointment, PaymentMethod, InvoiceStatus } from '../api/client';
import { formatMoney, currencySymbol } from '../utils/money';
import { generateInvoicePDF } from '../utils/generateInvoicePDF';
import { currentSlug } from '../tenant';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { Plus, Trash2, Pencil, FileText, Calendar, X, Receipt, Wallet, BarChart3, Search, CreditCard, Banknote, Smartphone, MoreHorizontal, Printer } from 'lucide-react';

// Sube el PDF de la factura al storage (best-effort: si falla, no rompe la creación).
async function uploadInvoicePdf(invoice: InvoiceDetail, currency: string) {
  try {
    const blob = await generateInvoicePDF(invoice, { name: 'Clínica', slug: currentSlug() || 'clinica', currency });
    await api.invoices.uploadPdf(invoice.id, blob);
  } catch (e) {
    console.warn('No se pudo guardar el PDF de la factura en storage:', e);
  }
}

type Tab = 'invoices' | 'procedures' | 'report';

const PAYMENT_METHODS: { value: PaymentMethod; label: string; Icon: typeof Banknote }[] = [
  { value: 'cash',     label: 'Efectivo',      Icon: Banknote },
  { value: 'card',     label: 'Tarjeta',       Icon: CreditCard },
  { value: 'transfer', label: 'Transferencia', Icon: Smartphone },
  { value: 'other',    label: 'Otro',          Icon: MoreHorizontal },
];

const STATUS_LABEL: Record<InvoiceStatus, { label: string; cls: string }> = {
  draft:     { label: 'Borrador',  cls: 'bg-gray-100 text-gray-700' },
  issued:    { label: 'Emitida',   cls: 'bg-blue-100 text-blue-700' },
  partial:   { label: 'Parcial',   cls: 'bg-amber-100 text-amber-700' },
  paid:      { label: 'Pagada',    cls: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Anulada',   cls: 'bg-red-100 text-red-700' },
};

export default function Finance() {
  const [tab, setTab] = useState<Tab>('invoices');
  const [settings, setSettings] = useState<FinanceSettings | null>(null);
  // ?new_invoice_appointment=ID → abre el modal de crear factura precargado
  // ?invoice=ID → abre directamente el detalle de una factura existente
  const params = new URLSearchParams(window.location.search);
  const prefilledAppt = params.get('new_invoice_appointment');
  const initialPrefilledId = prefilledAppt ? Number(prefilledAppt) : undefined;
  const openInvoiceParam = params.get('invoice');
  const initialOpenInvoiceId = openInvoiceParam ? Number(openInvoiceParam) : undefined;

  useEffect(() => { api.finance.settings().then(setSettings).catch(() => {}); }, []);
  const currency = settings?.currency || 'HNL';

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Finanzas</h1>
        <p className="text-sm text-gray-500">
          Facturas, abonos y reportes · Moneda: <span className="font-medium">{currency}</span>
          {settings && Number(settings.tax_rate) > 0 && <> · IVA por defecto: {settings.tax_rate}%</>}
        </p>
      </div>

      <div className="flex gap-1 mb-5 bg-gray-100 rounded-lg p-1">
        {([
          { id: 'invoices',   label: 'Facturas',      Icon: Receipt },
          { id: 'procedures', label: 'Procedimientos', Icon: FileText },
          { id: 'report',     label: 'Reportes',      Icon: BarChart3 },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-sm font-medium rounded-md transition-colors ${tab === t.id ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>
            <t.Icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'invoices'   && <InvoicesTab currency={currency} settings={settings} prefilledAppointmentId={initialPrefilledId} openInvoiceId={initialOpenInvoiceId} />}
      {tab === 'procedures' && <ProceduresTab currency={currency} />}
      {tab === 'report'     && <ReportTab currency={currency} />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// PROCEDIMIENTOS
// ════════════════════════════════════════════════════════════════════════

function ProceduresTab({ currency }: { currency: string }) {
  const [items, setItems] = useState<Procedure[]>([]);
  const [modal, setModal] = useState<{ procedure?: Procedure } | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', code: '', description: '', default_price: '', duration_minutes: '' });
  const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => setItems(await api.procedures.list(true)), []);
  useEffect(() => { load(); }, [load]);

  const open = (p?: Procedure) => {
    setForm({
      name: p?.name || '', code: p?.code || '', description: p?.description || '',
      default_price: p ? String(p.default_price) : '', duration_minutes: p?.duration_minutes ? String(p.duration_minutes) : ''
    });
    setError(''); setModal({ procedure: p });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const payload = {
        name: form.name.trim(), code: form.code.trim() || null, description: form.description.trim() || null,
        default_price: Number(form.default_price) || 0,
        duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
      };
      if (modal?.procedure) await api.procedures.update(modal.procedure.id, payload);
      else await api.procedures.create(payload);
      await load(); setModal(null);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const remove = async () => {
    if (!deleteId) return;
    await api.procedures.delete(deleteId);
    await load(); setDeleteId(null);
  };

  const filtered = items.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.code || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm"
            placeholder="Buscar procedimiento..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={() => open()} className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Nuevo
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-10">Sin procedimientos. Crea el primero para usarlo en facturas.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50 overflow-hidden">
          {filtered.map(p => (
            <div key={p.id} className="flex items-center justify-between p-3.5 gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900 truncate">{p.name}</p>
                  {p.code && <span className="text-xs text-gray-400">#{p.code}</span>}
                  {!p.active && <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">Inactivo</span>}
                </div>
                {p.description && <p className="text-xs text-gray-500 truncate mt-0.5">{p.description}</p>}
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-gray-900">{formatMoney(p.default_price, currency)}</p>
                {p.duration_minutes && <p className="text-[10px] text-gray-400">{p.duration_minutes} min</p>}
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => open(p)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => setDeleteId(p.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <Modal title={modal.procedure ? 'Editar procedimiento' : 'Nuevo procedimiento'} onClose={() => setModal(null)}>
          <form onSubmit={submit} className="space-y-3">
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-700 mb-1 block">Nombre *</label>
                <input required className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ej. Limpieza dental" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Código</label>
                <input className="input" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="LIMP-01" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Descripción</label>
              <textarea className="input resize-none" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Precio ({currencySymbol(currency)}) *</label>
                <input required type="number" min="0" step="0.01" className="input" value={form.default_price} onChange={e => setForm({ ...form, default_price: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Duración (min)</label>
                <input type="number" min="0" className="input" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: e.target.value })} placeholder="30" />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setModal(null)} className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancelar</button>
              <button type="submit" disabled={loading} className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
                {loading ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleteId && <ConfirmDialog message="¿Eliminar este procedimiento?" onConfirm={remove} onCancel={() => setDeleteId(null)} />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// FACTURAS
// ════════════════════════════════════════════════════════════════════════

interface InvoiceItemDraft { procedure_id: number | null; description: string; quantity: string; unit_price: string; }

function InvoicesTab({ currency, settings, prefilledAppointmentId, openInvoiceId }: {
  currency: string; settings: FinanceSettings | null;
  prefilledAppointmentId?: number; openInvoiceId?: number;
}) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | InvoiceStatus>('');
  const [detail, setDetail] = useState<InvoiceDetail | null>(null);
  const [showCreate, setShowCreate] = useState(!!prefilledAppointmentId);
  const [pendingAppt, setPendingAppt] = useState<number | undefined>(prefilledAppointmentId);

  // Limpia el query param tras consumirlo para que un refresh no reabra el modal
  useEffect(() => {
    if (prefilledAppointmentId) {
      const url = new URL(window.location.href);
      url.searchParams.delete('new_invoice_appointment');
      window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
    }
  }, [prefilledAppointmentId]);

  // ?invoice=ID → abrir directamente el detalle de la factura (desde Expediente)
  useEffect(() => {
    if (!openInvoiceId) return;
    api.invoices.get(openInvoiceId).then(setDetail).catch(() => {});
    const url = new URL(window.location.href);
    url.searchParams.delete('invoice');
    window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
  }, [openInvoiceId]);

  const load = useCallback(async () => {
    setInvoices(await api.invoices.list({ status: (statusFilter || undefined) as any, limit: 200 }));
  }, [statusFilter]);
  useEffect(() => { load(); }, [load]);

  const filtered = invoices.filter(i =>
    String(i.number).includes(search) ||
    i.user_name.toLowerCase().includes(search.toLowerCase())
  );

  const refreshDetail = async (id: number) => setDetail(await api.invoices.get(id));

  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm"
              placeholder="Buscar # o paciente..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
            className="text-sm border border-gray-200 rounded-lg px-2 py-2 bg-white shrink-0">
            <option value="">Todos</option>
            <option value="issued">Emitidas</option>
            <option value="partial">Parciales</option>
            <option value="paid">Pagadas</option>
            <option value="cancelled">Anuladas</option>
          </select>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Nueva factura
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-10">Sin facturas todavía.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(inv => (
            <button key={inv.id} onClick={() => refreshDetail(inv.id)}
              className="w-full text-left bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:border-blue-300 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-500">#{String(inv.number).padStart(4, '0')}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${STATUS_LABEL[inv.status].cls}`}>
                      {STATUS_LABEL[inv.status].label}
                    </span>
                  </div>
                  <p className="font-semibold text-gray-900 truncate mt-0.5">{inv.user_name}</p>
                  <p className="text-xs text-gray-400">
                    <Calendar className="w-3 h-3 inline -mt-0.5" /> {inv.date}
                    {inv.doctor_name && <> · Dr. {inv.doctor_name}</>}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-gray-900">{formatMoney(inv.total, currency)}</p>
                  {Number(inv.total_paid) > 0 && Number(inv.total_paid) < Number(inv.total) && (
                    <p className="text-xs text-amber-600">Pagado {formatMoney(inv.total_paid, currency)}</p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateInvoiceModal
          currency={currency} settings={settings}
          prefilledAppointmentId={pendingAppt}
          onClose={() => { setShowCreate(false); setPendingAppt(undefined); }}
          onCreated={async () => { setShowCreate(false); setPendingAppt(undefined); await load(); }}
        />
      )}

      {detail && (
        <InvoiceDetailModal
          invoice={detail} currency={currency}
          onClose={() => { setDetail(null); load(); }}
          onChange={async () => refreshDetail(detail.id)}
        />
      )}
    </div>
  );
}

// ── Modal: crear factura ────────────────────────────────────────────────

function CreateInvoiceModal({ currency, settings, prefilledAppointmentId, onClose, onCreated }: {
  currency: string; settings: FinanceSettings | null;
  prefilledAppointmentId?: number;
  onClose: () => void; onCreated: () => void;
}) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [appointmentId, setAppointmentId] = useState<number | ''>(prefilledAppointmentId || '');
  const [items, setItems] = useState<InvoiceItemDraft[]>([
    { procedure_id: null, description: '', quantity: '1', unit_price: '0' }
  ]);
  const [taxRate, setTaxRate] = useState<string>(settings ? String(settings.tax_rate) : '0');
  const [discount, setDiscount] = useState('0');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState(''); const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([api.appointments.list(), api.doctors.list(), api.procedures.list()])
      .then(([a, d, p]) => { setAppointments(a); setDoctors(d); setProcedures(p); });
  }, []);

  const selectedAppt = appointments.find(a => a.id === appointmentId);
  const date = selectedAppt?.date || new Date().toISOString().slice(0, 10);
  const userId = selectedAppt?.user_id || null;
  const doctorId = selectedAppt?.doctor_id || null;

  const setItem = (i: number, patch: Partial<InvoiceItemDraft>) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  const addItem = () => setItems(prev => [...prev, { procedure_id: null, description: '', quantity: '1', unit_price: '0' }]);
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));

  const pickProcedure = (i: number, procId: string) => {
    if (!procId) { setItem(i, { procedure_id: null }); return; }
    const p = procedures.find(x => x.id === Number(procId));
    if (!p) return;
    setItem(i, {
      procedure_id: p.id,
      description: p.name,
      unit_price: String(p.default_price),
    });
  };

  const subtotal = items.reduce((acc, it) => acc + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0);
  const dsc = Number(discount) || 0;
  const taxBase = Math.max(0, subtotal - dsc);
  const tax = taxBase * ((Number(taxRate) || 0) / 100);
  const total = taxBase + tax;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (!appointmentId || !userId) { setError('Selecciona una cita'); return; }
    if (items.length === 0) { setError('Agrega al menos un ítem'); return; }
    for (const it of items) {
      if (!it.description.trim()) { setError('Cada ítem necesita una descripción'); return; }
      if (Number(it.quantity) <= 0) { setError('La cantidad debe ser mayor que cero'); return; }
    }
    setLoading(true);
    try {
      const created = await api.invoices.create({
        user_id: userId,
        doctor_id: doctorId,
        appointment_id: Number(appointmentId),
        date, tax_rate: Number(taxRate) || 0, discount: dsc, notes: notes.trim() || undefined,
        items: items.map(it => ({
          procedure_id: it.procedure_id, description: it.description.trim(),
          quantity: Number(it.quantity), unit_price: Number(it.unit_price),
        })),
      });
      // Genera el PDF y lo sube a R2 (no bloquea la UI si falla)
      await uploadInvoicePdf(created, currency);
      onCreated();
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal title="Nueva factura" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">Cita asociada *</label>
          <select required className="input" value={appointmentId}
            onChange={e => setAppointmentId(e.target.value ? Number(e.target.value) : '')}
            disabled={!!prefilledAppointmentId}>
            <option value="">Selecciona una cita</option>
            {appointments.map(a => (
              <option key={a.id} value={a.id}>
                #{a.id} · {a.date} {a.time} · {a.user_name} · Dr. {a.doctor_name}
              </option>
            ))}
          </select>
          {selectedAppt && (
            <p className="text-xs text-gray-500 mt-1">
              <span className="font-medium">{selectedAppt.user_name}</span>
              {' '}con Dr. {doctors.find(d => d.id === selectedAppt.doctor_id)?.name || selectedAppt.doctor_name}
              {' '}el {selectedAppt.date} {selectedAppt.time}
            </p>
          )}
        </div>

        {/* Items */}
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">Procedimientos *</label>
          <div className="space-y-2">
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-start">
                <div className="col-span-5">
                  <select className="input text-xs"
                    value={it.procedure_id || ''}
                    onChange={e => pickProcedure(i, e.target.value)}>
                    <option value="">— Manual —</option>
                    {procedures.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input className="input mt-1 text-xs" placeholder="Descripción"
                    value={it.description} onChange={e => setItem(i, { description: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <input className="input text-xs text-right" type="number" min="0" step="0.5"
                    value={it.quantity} onChange={e => setItem(i, { quantity: e.target.value })} placeholder="Cant" />
                </div>
                <div className="col-span-3">
                  <input className="input text-xs text-right" type="number" min="0" step="0.01"
                    value={it.unit_price} onChange={e => setItem(i, { unit_price: e.target.value })} placeholder="Precio" />
                </div>
                <div className="col-span-1 text-right text-xs text-gray-600 pt-2">
                  {((Number(it.quantity) || 0) * (Number(it.unit_price) || 0)).toFixed(2)}
                </div>
                <button type="button" onClick={() => removeItem(i)} disabled={items.length === 1}
                  className="col-span-1 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-30">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addItem} className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:underline">
            <Plus className="w-3 h-3" /> Agregar ítem
          </button>
        </div>

        {/* Totales */}
        <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span><span>{formatMoney(subtotal, currency)}</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600 flex-1">Descuento</label>
            <input type="number" min="0" step="0.01" className="input w-28 text-xs text-right"
              value={discount} onChange={e => setDiscount(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600 flex-1">IVA (%)</label>
            <input type="number" min="0" max="100" step="0.01" className="input w-28 text-xs text-right"
              value={taxRate} onChange={e => setTaxRate(e.target.value)} />
            <span className="text-xs text-gray-500 w-20 text-right">{formatMoney(tax, currency)}</span>
          </div>
          <div className="flex justify-between font-bold text-gray-900 pt-2 border-t border-gray-200">
            <span>Total</span><span>{formatMoney(total, currency)}</span>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">Notas</label>
          <textarea className="input resize-none" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancelar</button>
          <button type="submit" disabled={loading} className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
            {loading ? 'Creando…' : 'Crear factura'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Modal: detalle de factura + abonos ──────────────────────────────────

function InvoiceDetailModal({ invoice, currency, onClose, onChange }: {
  invoice: InvoiceDetail; currency: string; onClose: () => void; onChange: () => Promise<void>;
}) {
  const [showPayment, setShowPayment] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDeletePayment, setConfirmDeletePayment] = useState<number | null>(null);

  const balance = Number(invoice.total) - Number(invoice.total_paid);
  const status = STATUS_LABEL[invoice.status];

  const cancel = async () => {
    await api.invoices.setStatus(invoice.id, 'cancelled');
    setConfirmCancel(false); await onChange();
  };
  const remove = async () => {
    await api.invoices.delete(invoice.id);
    setConfirmDelete(false); onClose();
  };
  const deletePayment = async (pid: number) => {
    await api.invoices.deletePayment(invoice.id, pid);
    setConfirmDeletePayment(null); await onChange();
  };

  const print = async () => {
    try {
      // Si el PDF aún no se generó (o se actualizó), lo regeneramos ahora con los abonos actuales
      const blob = await generateInvoicePDF(invoice, { name: 'Clínica', slug: currentSlug() || 'clinica', currency });
      // Sube el PDF actualizado (best-effort)
      api.invoices.uploadPdf(invoice.id, blob).catch(() => {});
      // Abre en nueva pestaña inmediatamente sin esperar al upload
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      console.error('Error generando PDF:', e);
    }
  };

  return (
    <Modal title={`Factura #${String(invoice.number).padStart(4, '0')}`} onClose={onClose}>
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate">{invoice.user_name}</p>
            <p className="text-xs text-gray-500">
              {invoice.date}{invoice.doctor_name && <> · Dr. {invoice.doctor_name}</>}
              {invoice.appointment_id && <> · Cita #{invoice.appointment_id}</>}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-xs font-bold px-2 py-1 rounded ${status.cls}`}>{status.label}</span>
            <button onClick={print}
              title="Imprimir / Descargar PDF"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg">
              <Printer className="w-3.5 h-3.5" /> Imprimir
            </button>
          </div>
        </div>

        {/* Items */}
        <div className="border border-gray-100 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="text-left px-3 py-1.5">Descripción</th>
                <th className="text-right px-3 py-1.5 w-12">Cant</th>
                <th className="text-right px-3 py-1.5 w-20">Precio</th>
                <th className="text-right px-3 py-1.5 w-24">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map(it => (
                <tr key={it.id} className="border-t border-gray-100">
                  <td className="px-3 py-2">
                    {it.description}
                    {it.procedure_name && it.procedure_name !== it.description && (
                      <span className="text-gray-400"> ({it.procedure_name})</span>
                    )}
                  </td>
                  <td className="text-right px-3 py-2">{it.quantity}</td>
                  <td className="text-right px-3 py-2">{Number(it.unit_price).toFixed(2)}</td>
                  <td className="text-right px-3 py-2 font-medium">{Number(it.total).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totales */}
        <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
          <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{formatMoney(invoice.subtotal, currency)}</span></div>
          {Number(invoice.discount) > 0 && <div className="flex justify-between text-gray-600"><span>Descuento</span><span>− {formatMoney(invoice.discount, currency)}</span></div>}
          {Number(invoice.tax) > 0 && <div className="flex justify-between text-gray-600"><span>IVA ({invoice.tax_rate}%)</span><span>{formatMoney(invoice.tax, currency)}</span></div>}
          <div className="flex justify-between font-bold text-gray-900 pt-1 border-t border-gray-200"><span>Total</span><span>{formatMoney(invoice.total, currency)}</span></div>
          <div className="flex justify-between text-green-700"><span>Pagado</span><span>{formatMoney(invoice.total_paid, currency)}</span></div>
          {balance > 0 && invoice.status !== 'cancelled' && (
            <div className="flex justify-between font-semibold text-amber-700"><span>Saldo</span><span>{formatMoney(balance, currency)}</span></div>
          )}
        </div>

        {/* Abonos */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-700">Abonos</h3>
            {invoice.status !== 'cancelled' && balance > 0 && (
              <button onClick={() => setShowPayment(true)} className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">
                <Plus className="w-3.5 h-3.5" /> Registrar abono
              </button>
            )}
          </div>
          {invoice.payments.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">Sin abonos.</p>
          ) : (
            <div className="space-y-1.5">
              {invoice.payments.map(p => {
                const m = PAYMENT_METHODS.find(x => x.value === p.method)!;
                return (
                  <div key={p.id} className="flex items-center gap-2 border border-gray-100 rounded-lg p-2 text-sm">
                    <m.Icon className="w-4 h-4 text-gray-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800">{formatMoney(p.amount, currency)} · {m.label}</p>
                      <p className="text-[10px] text-gray-400">
                        {p.date}
                        {p.reference && ` · Ref ${p.reference}`}
                        {p.received_by_name && ` · ${p.received_by_name}`}
                      </p>
                    </div>
                    <button onClick={() => setConfirmDeletePayment(p.id)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {invoice.notes && (
          <div className="text-xs bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-amber-800">{invoice.notes}</div>
        )}

        {/* Acciones */}
        <div className="flex gap-2 pt-2 border-t border-gray-100">
          {invoice.status !== 'cancelled' && (
            <button onClick={() => setConfirmCancel(true)} className="flex-1 py-2 text-sm font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100">
              Anular factura
            </button>
          )}
          <button onClick={() => setConfirmDelete(true)} className="flex-1 py-2 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100">
            Eliminar
          </button>
        </div>
      </div>

      {showPayment && (
        <AddPaymentModal invoiceId={invoice.id} balance={balance} currency={currency}
          onClose={() => setShowPayment(false)}
          onAdded={async () => { setShowPayment(false); await onChange(); }} />
      )}
      {confirmCancel && <ConfirmDialog message="¿Anular esta factura? Quedará marcada como anulada (no se podrán registrar más abonos)." onConfirm={cancel} onCancel={() => setConfirmCancel(false)} />}
      {confirmDelete && <ConfirmDialog message="¿Eliminar esta factura? Se borrarán también todos sus abonos. No se puede deshacer." onConfirm={remove} onCancel={() => setConfirmDelete(false)} />}
      {confirmDeletePayment !== null && <ConfirmDialog message="¿Eliminar este abono?" onConfirm={() => deletePayment(confirmDeletePayment)} onCancel={() => setConfirmDeletePayment(null)} />}
    </Modal>
  );
}

// ── Modal: registrar abono ──────────────────────────────────────────────

function AddPaymentModal({ invoiceId, balance, currency, onClose, onAdded }: {
  invoiceId: number; balance: number; currency: string;
  onClose: () => void; onAdded: () => void;
}) {
  const [amount, setAmount] = useState(String(balance));
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [reference, setReference] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [error, setError] = useState(''); const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      await api.invoices.addPayment(invoiceId, {
        amount: Number(amount), method, reference: reference.trim() || undefined,
        date, notes: notes.trim() || undefined,
      });
      onAdded();
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal title="Registrar abono" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <p className="text-xs text-gray-500">Saldo pendiente: <span className="font-medium">{formatMoney(balance, currency)}</span></p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Monto ({currencySymbol(currency)}) *</label>
            <input required type="number" min="0.01" step="0.01" className="input" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Fecha *</label>
            <input required type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">Método *</label>
          <div className="grid grid-cols-4 gap-1">
            {PAYMENT_METHODS.map(m => (
              <button key={m.value} type="button" onClick={() => setMethod(m.value)}
                className={`flex flex-col items-center gap-1 py-2 text-xs font-medium rounded-lg border ${
                  method === m.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}>
                <m.Icon className="w-4 h-4" /> {m.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">Referencia (opcional)</label>
          <input className="input" value={reference} onChange={e => setReference(e.target.value)} placeholder="# transacción, # cheque, etc." />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">Notas</label>
          <textarea className="input resize-none" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancelar</button>
          <button type="submit" disabled={loading} className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
            {loading ? 'Guardando…' : 'Registrar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════════════
// REPORTES
// ════════════════════════════════════════════════════════════════════════

function ReportTab({ currency }: { currency: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const startMonth = today.slice(0, 8) + '01';
  const [from, setFrom] = useState(startMonth);
  const [to, setTo] = useState(today);
  const [data, setData] = useState<FinanceReport | null>(null);

  const load = useCallback(async () => setData(await api.finance.report(from, to)), [from, to]);
  useEffect(() => { load(); }, [load]);

  if (!data) return <p className="text-sm text-gray-400 text-center py-10">Cargando…</p>;

  const methodLabel = (m: PaymentMethod) => PAYMENT_METHODS.find(x => x.value === m)?.label || m;
  const maxDay = Math.max(1, ...data.by_day.map(d => Number(d.total)));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500">Desde</label>
        <input type="date" className="input text-xs w-auto" value={from} onChange={e => setFrom(e.target.value)} />
        <label className="text-xs text-gray-500">Hasta</label>
        <input type="date" className="input text-xs w-auto" value={to} onChange={e => setTo(e.target.value)} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi label="Ingresos" value={formatMoney(data.summary.total_income, currency)} Icon={Wallet} color="green" />
        <Kpi label="Abonos" value={String(data.summary.payments_count)} Icon={Receipt} color="blue" />
        <Kpi label="Facturas cobradas" value={String(data.summary.invoices_paid)} Icon={FileText} color="blue" />
        <Kpi label="Por cobrar" value={formatMoney(data.receivable.receivable, currency)} Icon={BarChart3} color="amber"
          sub={`${data.receivable.pending_invoices} pendientes`} />
      </div>

      {/* Ingresos por día */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Ingresos por día</h3>
        {data.by_day.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">Sin abonos en este rango.</p>
        ) : (
          <div className="space-y-1">
            {data.by_day.map(d => (
              <div key={d.day} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-20 shrink-0">{d.day}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-blue-500 h-full rounded-full" style={{ width: `${(Number(d.total) / maxDay) * 100}%` }} />
                </div>
                <span className="text-xs font-medium text-gray-700 w-24 text-right">{formatMoney(d.total, currency)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {/* Por método */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Por método</h3>
          {data.by_method.length === 0 ? <p className="text-xs text-gray-400">—</p> : (
            <div className="space-y-2">
              {data.by_method.map(m => (
                <div key={m.method} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{methodLabel(m.method)} <span className="text-gray-400 text-xs">({m.count})</span></span>
                  <span className="font-medium text-gray-900">{formatMoney(m.total, currency)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Por médico */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Por médico</h3>
          {data.by_doctor.length === 0 ? <p className="text-xs text-gray-400">—</p> : (
            <div className="space-y-2">
              {data.by_doctor.map((d, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 truncate">{d.name || 'Sin médico'}</span>
                  <span className="font-medium text-gray-900">{formatMoney(d.total, currency)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top procedimientos */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Top procedimientos</h3>
        {data.by_procedure.length === 0 ? <p className="text-xs text-gray-400">—</p> : (
          <div className="space-y-2">
            {data.by_procedure.map((p, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-gray-600 truncate">{p.name} <span className="text-gray-400 text-xs">({Number(p.quantity)})</span></span>
                <span className="font-medium text-gray-900">{formatMoney(p.total, currency)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, Icon, color, sub }: {
  label: string; value: string; Icon: typeof Wallet; sub?: string;
  color: 'green' | 'blue' | 'amber';
}) {
  const colors = {
    green: 'text-green-600 bg-green-50',
    blue:  'text-blue-600 bg-blue-50',
    amber: 'text-amber-600 bg-amber-50',
  }[color];
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
      <div className={`inline-flex p-1.5 rounded-lg ${colors}`}><Icon className="w-4 h-4" /></div>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
      <p className="text-lg font-bold text-gray-900">{value}</p>
      {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
    </div>
  );
}
