import { useState, useEffect, useCallback } from 'react';
import { api, Consent, ConsentTemplate, User, Appointment } from '../api/client';
import { FileSignature, Plus, Printer, Trash2, AlertCircle, Link2, Copy, MessageCircle, Check, ExternalLink, Clock } from 'lucide-react';
import Modal from './Modal';
import ConfirmDialog from './ConfirmDialog';
import SignaturePad from './SignaturePad';

interface Props { user: User; }

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('es-ES');

export default function Consents({ user }: Props) {
  const [items, setItems] = useState<Consent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSign, setShowSign] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await api.consents.list(user.id)); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [user.id]);
  useEffect(() => { load(); }, [load]);

  const handlePrint = async (c: Consent) => {
    try {
      const { url } = await api.consents.pdfUrl(c.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      setError(e.message || 'No se pudo abrir el PDF');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await api.consents.delete(deleteId);
    setDeleteId(null);
    await load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
          <FileSignature className="w-4 h-4" />
          Consentimientos
          {items.length > 0 && <span className="text-xs text-gray-400">({items.length})</span>}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowAssign(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700">
            <Link2 className="w-3.5 h-3.5" /> Enviar enlace
          </button>
          <button onClick={() => setShowSign(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700">
            <Plus className="w-3.5 h-3.5" /> Firmar aquí
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-1.5 text-xs text-red-700 bg-red-50 rounded-lg px-2.5 py-1.5 mb-2">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? <p className="text-xs text-gray-400 py-2">Cargando…</p>
        : items.length === 0 ? (
          <p className="text-xs text-gray-400 py-2">
            Sin consentimientos. Firma aquí mismo en la clínica, o envía el enlace para que el paciente firme desde su celular.
          </p>
        ) : (
          <div className="space-y-1.5">
            {items.map(c => (
              <ConsentRow key={c.id} consent={c} onPrint={handlePrint} onDelete={() => setDeleteId(c.id)} />
            ))}
          </div>
        )
      }

      {showSign && (
        <SignConsentModal user={user}
          onClose={() => setShowSign(false)}
          onSigned={async () => { setShowSign(false); await load(); }} />
      )}
      {showAssign && (
        <AssignConsentModal user={user}
          onClose={() => setShowAssign(false)}
          onAssigned={async () => { await load(); }} />
      )}
      {deleteId && <ConfirmDialog message="¿Eliminar este consentimiento? No se puede deshacer." onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />}
    </div>
  );
}

// ── Fila de la lista: firmado o pendiente de firma remota ───────────────

function ConsentRow({ consent: c, onPrint, onDelete }: {
  consent: Consent; onPrint: (c: Consent) => void; onDelete: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const link = c.public_code ? `${window.location.origin}/consentimiento/${c.public_code}` : null;

  const copyLink = async () => {
    if (!link) return;
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { /* clipboard no disponible */ }
  };

  if (c.status === 'pending') {
    return (
      <div className="border border-amber-100 bg-amber-50/60 rounded-lg p-2">
        <div className="flex items-center gap-2">
          <div className="shrink-0 p-1.5 bg-amber-100 text-amber-700 rounded"><Clock className="w-4 h-4" /></div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{c.title}</p>
            <p className="text-[10px] text-amber-700">Pendiente de firma remota</p>
          </div>
          <button onClick={onDelete} title="Cancelar" className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
        {link && (
          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-amber-100">
            <button onClick={copyLink} className="flex items-center gap-1 text-[11px] font-medium text-amber-800 hover:underline">
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copied ? 'Copiado' : 'Copiar enlace'}
            </button>
            <a href={link} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] font-medium text-amber-800 hover:underline">
              <ExternalLink className="w-3 h-3" /> Abrir
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 border border-gray-100 rounded-lg p-2 bg-white">
      <div className="shrink-0 p-1.5 bg-blue-50 text-blue-600 rounded"><FileSignature className="w-4 h-4" /></div>
      <button onClick={() => onPrint(c)} className="flex-1 min-w-0 text-left hover:text-blue-700">
        <p className="text-sm font-medium text-gray-800 truncate">{c.title}</p>
        <p className="text-[10px] text-gray-400">
          Firmado por {c.signer_name}{c.signed_at && <> · {fmtDate(c.signed_at)}</>}
          {c.witnessed_by_name && ` · testigo: ${c.witnessed_by_name}`}
        </p>
      </button>
      <button onClick={() => onPrint(c)} title="Ver / imprimir"
        className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded">
        <Printer className="w-3.5 h-3.5" />
      </button>
      <button onClick={onDelete} title="Eliminar"
        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── Modal: firmar presencial (el paciente firma ahí mismo) ───────────────

function SignConsentModal({ user, onClose, onSigned }: {
  user: User; onClose: () => void; onSigned: () => void;
}) {
  const [templates, setTemplates] = useState<ConsentTemplate[]>([]);
  const [templateId, setTemplateId] = useState<number | ''>('');
  const [signerName, setSignerName] = useState(user.name);
  const [signerDocument, setSignerDocument] = useState(user.document_id || '');
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.consents.templates().then(list => setTemplates(list.filter(t => t.pdf_storage_key))).catch(() => {});
  }, []);

  const viewTemplate = async () => {
    if (!templateId) return;
    try {
      const { url } = await api.consents.templatePdfUrl(Number(templateId));
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch { /* noop */ }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (!templateId) { setError('Selecciona una plantilla'); return; }
    if (!signerName.trim()) { setError('Falta el nombre del firmante'); return; }
    if (!signature) { setError('El paciente debe firmar antes de continuar'); return; }
    setLoading(true);
    try {
      await api.consents.create({
        user_id: user.id,
        template_id: Number(templateId),
        signer_name: signerName.trim(),
        signer_document: signerDocument.trim() || undefined,
        signature_data_url: signature,
      });
      onSigned();
    } catch (e: any) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  return (
    <Modal title="Firmar consentimiento" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">Plantilla *</label>
          <div className="flex gap-2">
            <select required className="input flex-1" value={templateId} onChange={e => setTemplateId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Seleccionar…</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
            <button type="button" onClick={viewTemplate} disabled={!templateId}
              className="shrink-0 px-3 text-xs font-medium text-blue-600 border border-gray-200 rounded-lg hover:bg-blue-50 disabled:opacity-40">
              Ver
            </button>
          </div>
          {templates.length === 0 && (
            <p className="text-[10px] text-gray-400 mt-1">No hay plantillas con PDF cargado. Súbelas en Ajustes.</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Firmante *</label>
            <input required className="input" value={signerName} onChange={e => setSignerName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Documento</label>
            <input className="input" value={signerDocument} onChange={e => setSignerDocument(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">Firma *</label>
          <SignaturePad onChange={setSignature} />
          <p className="text-[10px] text-gray-400 mt-1">
            Pasa el dispositivo al paciente para que firme con el dedo o el mouse.
          </p>
        </div>

        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancelar</button>
          <button type="submit" disabled={loading} className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
            {loading ? 'Guardando…' : 'Firmar y guardar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Modal: asignar plantilla a una cita → enlace de firma remota ────────

function AssignConsentModal({ user, onClose, onAssigned }: {
  user: User; onClose: () => void; onAssigned: () => void;
}) {
  const [templates, setTemplates] = useState<ConsentTemplate[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [templateId, setTemplateId] = useState<number | ''>('');
  const [appointmentId, setAppointmentId] = useState<number | ''>('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.consents.templates().then(list => setTemplates(list.filter(t => t.pdf_storage_key))).catch(() => {});
    api.appointments.list()
      .then(list => setAppointments(
        list.filter(a => a.user_id === user.id).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
      ))
      .catch(() => {});
  }, [user.id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (!templateId) { setError('Selecciona una plantilla'); return; }
    if (!appointmentId) { setError('Selecciona una cita'); return; }
    setLoading(true);
    try {
      const created = await api.consents.assign({ user_id: user.id, appointment_id: Number(appointmentId), template_id: Number(templateId) });
      setLink(`${window.location.origin}/consentimiento/${created.public_code}`);
      onAssigned();
    } catch (e: any) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  const copyLink = async () => {
    if (!link) return;
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { /* clipboard no disponible */ }
  };

  const waLink = (() => {
    if (!link || !user.phone) return null;
    const phone = user.phone.replace(/\D/g, '');
    const msg = encodeURIComponent(`Hola ${user.name}, por favor firma este documento antes de tu cita: ${link}`);
    return `https://wa.me/${phone}?text=${msg}`;
  })();

  return (
    <Modal title="Enviar enlace de firma" onClose={onClose}>
      {link ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Enlace generado. Compártelo con el paciente para que firme desde su celular.</p>
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <p className="flex-1 text-xs text-gray-700 truncate">{link}</p>
            <button type="button" onClick={copyLink} className="shrink-0 text-blue-600 hover:text-blue-700">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <div className="flex gap-2">
            {waLink && (
              <a href={waLink} target="_blank" rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700">
                <MessageCircle className="w-4 h-4" /> WhatsApp
              </a>
            )}
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
              Listo
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Plantilla *</label>
            <select required className="input" value={templateId} onChange={e => setTemplateId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Seleccionar…</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
            {templates.length === 0 && (
              <p className="text-[10px] text-gray-400 mt-1">No hay plantillas con PDF cargado. Súbelas en Ajustes.</p>
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Cita *</label>
            <select required className="input" value={appointmentId} onChange={e => setAppointmentId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Seleccionar…</option>
              {appointments.map(a => <option key={a.id} value={a.id}>{a.date} {a.time} · Dr. {a.doctor_name}</option>)}
            </select>
            {appointments.length === 0 && (
              <p className="text-[10px] text-gray-400 mt-1">Este paciente no tiene citas todavía.</p>
            )}
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancelar</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
              {loading ? 'Generando…' : 'Generar enlace'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
