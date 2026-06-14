import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Stethoscope } from 'lucide-react';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

declare global {
  interface Window { google?: any; }
}

export default function Login() {
  const { login } = useAuth();
  const btnRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!CLIENT_ID) { setError('Falta configurar VITE_GOOGLE_CLIENT_ID.'); return; }

    const handleCredential = async (response: any) => {
      setError(''); setLoading(true);
      try {
        const { token, account } = await api.auth.google(response.credential);
        login(token, account);
      } catch (e: any) {
        setError(e.message || 'No se pudo iniciar sesión');
      } finally {
        setLoading(false);
      }
    };

    const init = () => {
      if (!window.google) return;
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: handleCredential,
      });
      if (btnRef.current) {
        window.google.accounts.id.renderButton(btnRef.current, {
          theme: 'outline', size: 'large', text: 'continue_with', shape: 'pill', width: 280,
        });
      }
    };

    // Carga el script de Google Identity Services si aún no está
    if (window.google) { init(); return; }
    const existing = document.getElementById('gsi-script');
    if (existing) { existing.addEventListener('load', init); return; }
    const script = document.createElement('script');
    script.id = 'gsi-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = init;
    document.body.appendChild(script);
  }, [login]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-gray-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-2 text-blue-700">
          <Stethoscope className="w-7 h-7" />
          <span className="font-bold text-2xl tracking-tight">ClínicaPro</span>
        </div>
        <p className="text-sm text-gray-500 mb-6">Inicia sesión para administrar la clínica</p>

        <div className="flex justify-center min-h-[44px]">
          {!loading && <div ref={btnRef} />}
          {loading && <p className="text-sm text-gray-400">Iniciando sesión...</p>}
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-4">{error}</p>}

        <p className="text-xs text-gray-400 mt-6">
          El acceso es solo por invitación. Si tu correo no está invitado, contacta al administrador.
        </p>
      </div>
    </div>
  );
}
