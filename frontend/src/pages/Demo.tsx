import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';

// Página pública de entrada a una clínica demo.
// URL: /demo/:slug?t=<demo_token>
// Pide nombre al visitante, llama a /api/demo/:slug/enter y entra al app.
export default function Demo() {
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { login } = useAuth();

  // Lee el token de la query string; sin token no se puede entrar.
  const token = new URLSearchParams(window.location.search).get('t') || '';

  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Modo demostración · odontiacloud';
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) { setError('Tu nombre debe tener al menos 2 letras'); return; }
    if (!token) { setError('Este enlace de demo no es válido (falta el token)'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.demo.enter(slug, token, name.trim());
      // Guardamos el token para que el botón de reset del banner lo reutilice.
      try { localStorage.setItem('demo_token_' + slug, token); } catch { /* navegador sin storage */ }
      login(res.token, res.account);
      navigate(`/${slug}/inicio`, { replace: true });
    } catch (e: any) {
      setError(e.message || 'No se pudo entrar a la demo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-blue-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6">
        <div className="flex justify-center mb-4">
          <img src="/logo.png" alt="odontiacloud" className="h-10 object-contain" />
        </div>

        <h1 className="text-xl font-bold text-gray-900 text-center">Modo demostración</h1>
        <p className="text-sm text-gray-500 text-center mt-1">
          Estás a punto de entrar a una clínica de prueba con datos reales.
          Introduce tu nombre para empezar.
        </p>

        <form onSubmit={submit} className="mt-5 space-y-3">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Tu nombre</label>
            <input
              autoFocus
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Ej. Juan Pérez"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          <button
            type="submit" disabled={loading}
            className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg disabled:opacity-60"
          >
            {loading ? 'Entrando…' : 'Entrar a la demo'}
          </button>
        </form>

        <p className="text-[11px] text-gray-400 text-center mt-4">
          Lo que hagas aquí lo verán los demás visitantes. Si necesitas
          datos frescos, dentro del sistema hay un botón para resetear.
        </p>
      </div>
    </div>
  );
}
