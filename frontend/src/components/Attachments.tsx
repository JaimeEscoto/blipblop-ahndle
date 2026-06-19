import { useState, useEffect, useCallback, useRef } from 'react';
import { api, Attachment } from '../api/client';
import { Paperclip, Upload, FileText, Image as ImageIcon, Trash2, Download, AlertCircle } from 'lucide-react';

interface Props {
  userId: number;
  // record_id de la visita clínica; undefined → adjuntos a nivel paciente (record_id IS NULL)
  recordId?: number;
  // Pequeño (dentro de una tarjeta de visita) o normal (sección de paciente)
  compact?: boolean;
}

const MAX_MB = 10;
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,application/pdf';

export default function Attachments({ userId, recordId, compact }: Props) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
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

  const handleView = async (a: Attachment) => {
    try {
      const { url } = await api.attachments.getUrl(a.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      setError(e.message || 'No se pudo abrir el archivo');
    }
  };

  const handleDelete = async (a: Attachment) => {
    if (!window.confirm(`¿Eliminar "${a.file_name}"? No se puede deshacer.`)) return;
    try {
      await api.attachments.delete(a.id);
      setItems(prev => prev.filter(x => x.id !== a.id));
    } catch (e: any) {
      setError(e.message || 'No se pudo eliminar');
    }
  };

  const fmtSize = (b: number) => b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;
  const isImage = (a: Attachment) => a.mime_type.startsWith('image/');

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
              <button onClick={() => handleView(a)}
                className="flex-1 min-w-0 text-left hover:text-blue-700">
                <p className="text-sm font-medium text-gray-800 truncate">{a.file_name}</p>
                <p className="text-[10px] text-gray-400">
                  {fmtSize(a.size_bytes)} · {new Date(a.uploaded_at).toLocaleDateString('es-ES')}
                  {a.uploaded_by_name && ` · ${a.uploaded_by_name}`}
                </p>
              </button>
              <button onClick={() => handleView(a)}
                title="Ver / descargar"
                className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                <Download className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => handleDelete(a)}
                title="Eliminar"
                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
