import { useState, useEffect, useCallback } from 'react';
import { api, Consent, ConsentTemplate, User } from '../api/client';
import { FileSignature, Plus, Printer, Trash2, AlertCircle } from 'lucide-react';
import { currentSlug } from '../tenant';
import { generateConsentPDF } from '../utils/generateConsentPDF';
import Modal from './Modal';
import ConfirmDialog from './ConfirmDialog';
import SignaturePad from './SignaturePad';

interface Props { user: User; }

export default function Consents({ user }: Props) {
  const [items, setItems] = useState<Consent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSign, setShowSign] = useState(false);
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
          Consentimientos firmados
          {items.length > 0 && <span className="text-xs text-gray-400">({items.length})</span>}
        </div>
        <button onClick={() => setShowSign(true)}
          className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700">
          <Plus className="w-3.5 h-3.5" /> Firmar nuevo
        </button>
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
            Sin consentimientos. Crea plantillas en Ajustes y firma con el paciente desde aquí.
          </p>
        ) : (
          <div className="space-y-1.5">
            {items.map(c => (
              <div key={c.id} className="flex items-center gap-2 border border-gray-100 rounded-lg p-2 bg-white">
                <div className="shrink-0 p-1.5 bg-blue-50 text-blue-600 rounded"><FileSignature className="w-4 h-4" /></div>
                <button onClick={() => handlePrint(c)} className="flex-1 min-w-0 text-left hover:text-blue-700">
                  <p className="text-sm font-medium text-gray-800 truncate">{c.title}</p>
                  <p className="text-[10px] text-gray-400">
                    Firmado por {c.signer_name} · {new Date(c.signed_at).toLocaleDateString('es-ES')}
                    {c.witnessed_by_name && ` · testigo: ${c.witnessed_by_name}`}
                  </p>
                </button>
                <button onClick={() => handlePrint(c)} title="Ver / imprimir"
                  className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                  <Printer className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setDeleteId(c.id)} title="Eliminar"
                  className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )
      }

      {showSign && (
        <SignConsentModal user={user}
          onClose={() => setShowSign(false)}
          onSigned={async () => { setShowSign(false); await load(); }} />
      )}
      {deleteId && <ConfirmDialog message="¿Eliminar este consentimiento firmado? No se puede deshacer." onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />}
    </div>
  );
}

// ── Modal: firmar un nuevo consentimiento ──────────────────────────────

function SignConsentModal({ user, onClose, onSigned }: {
  user: User; onClose: () => void; onSigned: () => void;
}) {
  const [templates, setTemplates] = useState<ConsentTemplate[]>([]);
  const [templateId, setTemplateId] = useState<number | ''>('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [signerName, setSignerName] = useState(user.name);
  const [signerDocument, setSignerDocument] = useState(user.document_id || '');
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.consents.templates().then(setTemplates).catch(() => {});
  }, []);

  const pickTemplate = (id: string) => {
    setTemplateId(id ? Number(id) : '');
    if (!id) { setTitle(''); setBody(''); return; }
    const t = templates.find(x => x.id === Number(id));
    if (t) { setTitle(t.title); setBody(t.body); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (!title.trim() || !body.trim()) { setError('Faltan título y contenido'); return; }
    if (!signerName.trim()) { setError('Falta el nombre del firmante'); return; }
    if (!signature) { setError('El paciente debe firmar antes de continuar'); return; }
    setLoading(true);
    try {
      const created = await api.consents.create({
        user_id: user.id,
        template_id: templateId || null,
        title: title.trim(), body: body.trim(),
        signer_name: signerName.trim(),
        signer_document: signerDocument.trim() || undefined,
        signature_data_url: signature,
      });
      // Genera el PDF y lo sube (best-effort)
      try {
        const blob = await generateConsentPDF({
          clinic: { name: 'Clínica', slug: currentSlug() || 'clinica' },
          title: created.title, body: created.body,
          signerName: created.signer_name, signerDocument: created.signer_document || undefined,
          signedAt: created.signed_at,
          witnessName: created.witnessed_by_name,
          signatureDataUrl: signature,
        });
        await api.consents.uploadPdf(created.id, blob);
      } catch (e) {
        console.warn('No se pudo subir el PDF del consentimiento:', e);
      }
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
          <label className="text-xs font-medium text-gray-700 mb-1 block">Plantilla</label>
          <select className="input" value={templateId} onChange={e => pickTemplate(e.target.value)}>
            <option value="">— En blanco (escribir manualmente) —</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
          {templates.length === 0 && (
            <p className="text-[10px] text-gray-400 mt-1">No hay plantillas. Créalas en Ajustes para reutilizarlas.</p>
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">Título *</label>
          <input required className="input" value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Ej. Consentimiento para extracción" />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">Contenido *</label>
          <textarea required className="input resize-none font-mono text-xs" rows={6}
            value={body} onChange={e => setBody(e.target.value)}
            placeholder="Texto del consentimiento que firmará el paciente..." />
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
