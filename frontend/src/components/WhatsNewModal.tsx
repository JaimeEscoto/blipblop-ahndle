import { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { RELEASE_NOTES, LATEST_RELEASE_NOTE_ID, ReleaseNote } from '../data/releaseNotes';

const STORAGE_KEY = 'oc_last_release_note_id';

// Modal de "Novedades" que aparece una sola vez al usuario cuando hay
// entradas nuevas en releaseNotes.ts que aún no ha visto (comparado contra
// el id guardado en localStorage). Al cerrarlo, guarda el máximo id visto.
// No aparece para visitantes demo (para que la primera experiencia sea limpia).
export default function WhatsNewModal({ isDemoVisitor }: { isDemoVisitor?: boolean }) {
  const [pending, setPending] = useState<ReleaseNote[]>([]);

  useEffect(() => {
    if (isDemoVisitor) return;
    let lastSeen = 0;
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      lastSeen = v ? Number(v) : 0;
    } catch { /* privado o desactivado */ }
    // Si no hay nada visto aún (usuario nuevo), no mostramos el histórico:
    // marcamos todo como visto silenciosamente para que solo vea lo que
    // venga a partir de ahora.
    if (lastSeen === 0) {
      try { localStorage.setItem(STORAGE_KEY, String(LATEST_RELEASE_NOTE_ID)); } catch {}
      return;
    }
    const unseen = RELEASE_NOTES.filter(n => n.id > lastSeen).sort((a, b) => b.id - a.id);
    if (unseen.length > 0) setPending(unseen);
  }, [isDemoVisitor]);

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, String(LATEST_RELEASE_NOTE_ID)); } catch {}
    setPending([]);
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
              {pending.length === 1 ? 'Una novedad nueva desde tu última visita' : `${pending.length} novedades nuevas desde tu última visita`}
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
              <div className="text-2xl leading-none shrink-0" aria-hidden="true">{n.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400 mb-0.5">{n.date}</p>
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
