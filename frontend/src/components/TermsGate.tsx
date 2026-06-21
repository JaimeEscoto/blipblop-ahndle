import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';

// Tras login, verifica si el usuario actual aceptó la versión vigente de
// los Términos de Servicio. Si no, muestra un modal bloqueante hasta que
// la acepte. Útil para clínicas creadas antes de tener este flujo, o
// cuando los términos cambian.
export default function TermsGate() {
  const { account, logout } = useAuth();
  const [needsAccept, setNeedsAccept] = useState(false);
  const [terms, setTerms] = useState<{ id: number; version: string; content: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!account) return;
    // El superuser global no opera bajo una clínica; no aplica aceptación.
    if (account.role === 'superuser' && account.clinic_id === null) return;
    api.terms.status()
      .then(s => {
        if (!s.accepted && s.current) {
          setNeedsAccept(true);
          return api.terms.current().then(t => setTerms({ id: t.id, version: t.version, content: t.content }));
        }
      })
      .catch(() => { /* si falla, no bloqueamos la app */ });
  }, [account]);

  const accept = async () => {
    setSubmitting(true);
    setError('');
    try {
      await api.terms.accept();
      setNeedsAccept(false);
    } catch (e: any) {
      setError(e.message || 'No se pudo registrar la aceptación.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!needsAccept || !terms) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Términos de Servicio actualizados</h3>
            <p className="text-xs text-gray-500">Versión {terms.version}. Acepta para continuar usando OdontiaCloud.</p>
          </div>
          <button onClick={() => logout()} title="Cerrar sesión"
            className="p-1 rounded hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto whitespace-pre-wrap text-sm text-gray-700 leading-relaxed font-mono">
          {terms.content}
        </div>
        {error && <p className="px-5 pb-2 text-sm text-red-600">{error}</p>}
        <div className="px-5 py-3 border-t flex justify-between gap-2">
          <button onClick={() => logout()}
            className="px-4 py-1.5 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">
            Salir
          </button>
          <button onClick={accept} disabled={submitting}
            className="px-4 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
            {submitting ? 'Registrando…' : 'Acepto los Términos'}
          </button>
        </div>
      </div>
    </div>
  );
}
