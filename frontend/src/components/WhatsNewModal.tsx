import { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { api, ReleaseNote } from '../api/client';

// Modal de "Novedades": muestra las notas pendientes desde el servidor
// (publicadas después de que la cuenta fue creada y aún no ack). Al cerrarlo
// confirma acks al backend, para que en el próximo login no reaparezcan.
// No se muestra a visitantes demo (el endpoint devuelve [] igual).
export default function WhatsNewModal({ isDemoVisitor }: { isDemoVisitor?: boolean }) {
  const [pending, setPending] = useState<ReleaseNote[]>([]);

  useEffect(() => {
    if (isDemoVisitor) return;
    api.releaseNotes.pending()
      .then(setPending)
      .catch(() => { /* si falla, silencio: no bloqueamos la app */ });
  }, [isDemoVisitor]);

  const dismiss = async () => {
    const ids = pending.map(n => n.id);
    // Optimista: cerramos la UI ya, y mandamos los acks en background.
    setPending([]);
    ids.forEach(id => { api.releaseNotes.ack(id).catch(() => {}); });
  };

  if (pending.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
         onClick={dismiss}>
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl max-h-[85vh] flex flex-col"
      >
        <div className="p-5 border-b border-gray-100 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-900">Novedades</h2>
            <p className="text-xs text-gray-500">
              {pending.length === 1
                ? 'Una novedad nueva desde tu última visita'
                : `${pending.length} novedades nuevas desde tu última visita`}
            </p>
          </div>
          <button
            onClick={dismiss}
            aria-label="Cerrar"
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {pending.map(n => (
            <div key={n.id} className="flex gap-3">
              <div className="text-2xl leading-none shrink-0" aria-hidden="true">
                {n.icon || '✨'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400 mb-0.5">{n.published_at}</p>
                <h3 className="text-sm font-semibold text-gray-900">{n.title}</h3>
                <p
                  className="text-sm text-gray-600 mt-1 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: n.body }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-100 flex justify-end">
          <button
            onClick={dismiss}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
