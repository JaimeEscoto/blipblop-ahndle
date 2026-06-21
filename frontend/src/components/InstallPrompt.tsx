import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

// Banner discreto que ofrece instalar la app cuando el navegador lo permite.
// Chrome/Edge/Android disparan 'beforeinstallprompt'; iOS no, así que ahí
// mostramos una instrucción manual breve si está corriendo en Safari.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'pwa_install_dismissed_at';
const DISMISS_DAYS = 14; // si lo cierran, no volver a mostrar en 14 días

function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

function isIosSafari(): boolean {
  const ua = window.navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const webkit = /WebKit/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return iOS && webkit;
}

function recentlyDismissed(): boolean {
  const v = localStorage.getItem(DISMISS_KEY);
  if (!v) return false;
  const at = Number(v);
  if (Number.isNaN(at)) return false;
  return Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    // iOS no dispara el evento; mostramos hint manual tras 3 segundos
    let timer: any;
    if (isIosSafari()) {
      timer = setTimeout(() => setShowIosHint(true), 3000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      if (timer) clearTimeout(timer);
    };
  }, []);

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setClosed(true);
  };

  if (closed) return null;
  if (!deferred && !showIosHint) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 max-w-sm w-[calc(100%-2rem)] bg-white border border-gray-200 rounded-2xl shadow-2xl p-4 flex items-start gap-3">
      <img src="/icono.png" alt="" className="w-10 h-10 object-contain shrink-0" />
      <div className="flex-1 min-w-0">
        {deferred ? (
          <>
            <p className="text-sm font-semibold text-gray-900">Instalar odontiacloud</p>
            <p className="text-xs text-gray-500 mt-0.5">Tendrás la app en tu inicio, sin barras del navegador.</p>
            <button onClick={install}
              className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg">
              <Download className="w-3.5 h-3.5" /> Instalar
            </button>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-gray-900">Añade odontiacloud al inicio</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Toca <span className="font-mono px-1 bg-gray-100 rounded">Compartir</span> →{' '}
              <span className="font-mono px-1 bg-gray-100 rounded">Añadir a inicio</span>
            </p>
          </>
        )}
      </div>
      <button onClick={dismiss}
        title="No mostrar por un tiempo"
        className="shrink-0 p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
