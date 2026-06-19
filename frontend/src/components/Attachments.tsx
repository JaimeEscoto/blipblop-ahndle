import { useState, useEffect, useCallback, useRef } from 'react';
import { api, Attachment } from '../api/client';
import { Paperclip, Upload, FileText, Image as ImageIcon, Trash2, Download, AlertCircle, Pencil, X, Check, Loader2 } from 'lucide-react';

interface Props {
  userId: number;
  // record_id de la visita clínica; undefined → adjuntos a nivel paciente (record_id IS NULL)
  recordId?: number;
  compact?: boolean;
}

const MAX_MB = 10;
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,application/pdf';

export default function Attachments({ userId, recordId, compact }: Props) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [previewId, setPreviewId] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.attachments.list(userId, recordId ?? 'patient');
      setItems(data);
    } catch (e: any) {
      setError(e.message || 'No se pudieron cargar los archivos');
    } finally { setLoading(false); }
  }, [userId, recordId]);

  useEffect(() => { load(); }, [load]);

  const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setError('');
    for (const file of Array.from(files)) {
      if (file.size > MAX_MB * 1024 * 1024) {
        setError(`"${file.name}" supera el límite de ${MAX_MB} MB`);
        continue;
      }
      setUploading(true);
      try {
        const created = await api.attachments.upload(file, userId, recordId);
        setItems(prev => [created, ...prev]);
      } catch (err: any) {
        setError(err.message || 'No se pudo subir el archivo');
      } finally {
        setUploading(false);
      }
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  const startRename = (a: Attachment) => {
    setRenamingId(a.id);
    setRenameValue(a.file_name);
  };

  const saveRename = async (a: Attachment) => {
    const next = renameValue.trim();
    if (!next || next === a.file_name) { setRenamingId(null); return; }
    try {
      const updated = await api.attachments.rename(a.id, next);
      setItems(prev => prev.map(x => x.id === a.id ? updated : x));
      setRenamingId(null);
    } catch (e: any) {
      setError(e.message || 'No se pudo renombrar');
    }
  };

  const handleDelete = async (a: Attachment) => {
    if (!window.confirm(`¿Eliminar "${a.file_name}"? No se puede deshacer.`)) return;
    try {
      await api.attachments.delete(a.id);
      setItems(prev => prev.filter(x => x.id !== a.id));
      if (previewId === a.id) setPreviewId(null);
    } catch (e: any) {
      setError(e.message || 'No se pudo eliminar');
    }
  };

  const fmtSize = (b: number) => b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;
  const isImage = (a: Attachment) => a.mime_type.startsWith('image/');

  const previewItem = items.find(x => x.id === previewId) || null;

  return (
    <div>
      {/* Encabezado + botón de subir */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
          <Paperclip className="w-4 h-4" />
          {compact ? 'Adjuntos' : 'Archivos del paciente'}
          {items.length > 0 && <span className="text-xs text-gray-400">({items.length})</span>}
        </div>
        <button onClick={() => inputRef.current?.click()} disabled={uploading}
          className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50">
          <Upload className="w-3.5 h-3.5" />
          {uploading ? 'Subiendo…' : 'Subir'}
        </button>
        <input ref={inputRef} type="file" accept={ACCEPT} multiple hidden onChange={handleSelect} />
      </div>

      {error && (
        <div className="flex items-start gap-1.5 text-xs text-red-700 bg-red-50 rounded-lg px-2.5 py-1.5 mb-2">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-gray-400 py-2">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-gray-400 py-2">
          Sin archivos. Acepta JPG, PNG, WebP y PDF (máx {MAX_MB} MB).
        </p>
      ) : (
        <div className={compact ? 'space-y-1.5' : 'grid sm:grid-cols-2 gap-2'}>
          {items.map(a => (
            <div key={a.id}
              className="flex items-center gap-2 border border-gray-100 rounded-lg p-2 bg-white">
              <div className={`shrink-0 p-1.5 rounded ${isImage(a) ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>
                {isImage(a) ? <ImageIcon className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
              </div>

              {renamingId === a.id ? (
                <div className="flex-1 min-w-0 flex items-center gap-1">
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveRename(a);
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    className="flex-1 min-w-0 px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                  <button onClick={() => saveRename(a)} title="Guardar"
                    className="p-1 text-green-600 hover:bg-green-50 rounded">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setRenamingId(null)} title="Cancelar"
                    className="p-1 text-gray-400 hover:bg-gray-50 rounded">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <button onClick={() => setPreviewId(a.id)}
                    className="flex-1 min-w-0 text-left hover:text-blue-700">
                    <p className="text-sm font-medium text-gray-800 truncate">{a.file_name}</p>
                    <p className="text-[10px] text-gray-400">
                      {fmtSize(a.size_bytes)} · {new Date(a.uploaded_at).toLocaleDateString('es-ES')}
                      {a.uploaded_by_name && ` · ${a.uploaded_by_name}`}
                    </p>
                  </button>
                  <button onClick={() => startRename(a)}
                    title="Renombrar"
                    className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(a)}
                    title="Eliminar"
                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {previewItem && (
        <PreviewModal attachment={previewItem} onClose={() => setPreviewId(null)} />
      )}
    </div>
  );
}

// ── Modal de previsualización ───────────────────────────────────────────────

function PreviewModal({ attachment, onClose }: { attachment: Attachment; onClose: () => void }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;
    setPreviewUrl(null); setDownloadUrl(null); setLoadError('');
    api.attachments.getUrl(attachment.id)
      .then(r => { if (active) { setPreviewUrl(r.previewUrl); setDownloadUrl(r.downloadUrl); } })
      .catch(e => { if (active) setLoadError(e.message || 'No se pudo cargar el archivo'); });
    return () => { active = false; };
  }, [attachment.id]);

  // Esc para cerrar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isImage = attachment.mime_type.startsWith('image/');
  const isPdf = attachment.mime_type === 'application/pdf';
  const fmtSize = (b: number) => b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 truncate" title={attachment.file_name}>
              {attachment.file_name}
            </p>
            <p className="text-xs text-gray-400">
              {fmtSize(attachment.size_bytes)} · {new Date(attachment.uploaded_at).toLocaleString('es-ES')}
              {attachment.uploaded_by_name && ` · ${attachment.uploaded_by_name}`}
            </p>
          </div>
          {downloadUrl && (
            <a href={downloadUrl}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg">
              <Download className="w-4 h-4" /> Descargar
            </a>
          )}
          <button onClick={onClose}
            title="Cerrar (Esc)"
            className="shrink-0 p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto bg-gray-50 flex items-center justify-center">
          {loadError && (
            <div className="text-center text-sm text-red-600 p-8">
              <AlertCircle className="w-8 h-8 mx-auto mb-2" />
              {loadError}
            </div>
          )}
          {!loadError && !previewUrl && (
            <div className="text-center text-gray-400 p-8">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              <p className="text-sm">Cargando previsualización…</p>
            </div>
          )}
          {previewUrl && isImage && (
            <img src={previewUrl} alt={attachment.file_name}
              className="max-w-full max-h-[75vh] object-contain" />
          )}
          {previewUrl && isPdf && (
            <iframe src={previewUrl} title={attachment.file_name}
              className="w-full h-[75vh] border-0 bg-white" />
          )}
          {previewUrl && !isImage && !isPdf && (
            <div className="text-center text-gray-500 p-8 text-sm">
              No hay previsualización para este tipo de archivo. Usa "Descargar".
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
