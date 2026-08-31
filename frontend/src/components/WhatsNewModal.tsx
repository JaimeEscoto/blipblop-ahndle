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
        className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-h-[85vh] flex flex-col"
      >
        <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Novedades del Sistema</h2>
              {pending.length > 1 && (
                <span className="px-2 py-0.5 text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 rounded-full">
                  {pending.length} nuevas
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {pending.length === 1
                ? 'Tienes 1 novedad no vista desde tu última visita'
                : `Tienes ${pending.length} novedades acumuladas que no has visto`}
            </p>
          </div>
          <button
            onClick={dismiss}
            aria-label="Cerrar"
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg shrink-0 dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-gray-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-3.5 flex-1">
          {pending.map((n, idx) => (
            <div key={n.id} className="flex gap-3.5 p-4 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-700/40">
              <div className="text-2xl leading-none shrink-0 p-2.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm h-fit" aria-hidden="true">
                {n.icon || '✨'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40 px-2 py-0.5 rounded-md">
                    Novedad #{pending.length - idx}
                  </span>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500">{n.published_at}</p>
                </div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">{n.title}</h3>
                <p
                  className="text-xs text-gray-600 dark:text-gray-300 mt-1 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: n.body }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {pending.length === 1 ? '1 aviso pendiente' : `${pending.length} avisos pendientes`}
          </span>
          <button
            onClick={dismiss}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
          >
            Entendido ({pending.length})
          </button>
        </div>
      </div>
    </div>
  );
}
