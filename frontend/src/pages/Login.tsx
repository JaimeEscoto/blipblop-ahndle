import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import LanguageToggle from '../components/LanguageToggle';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

declare global {
  interface Window { google?: any; }
}

export default function Login() {
  const { login } = useAuth();
  const { t, i18n } = useTranslation();
  const btnRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!CLIENT_ID) { setError(t('login.missingClientId')); return; }

    const handleCredential = async (response: any) => {
      setError(''); setLoading(true);
      try {
        const lang = i18n.language?.startsWith('en') ? 'en' : 'es';
        const { token, account } = await api.auth.google(response.credential, lang);
        login(token, account);
      } catch (e: any) {
        setError(e.message || t('login.failed'));
      } finally {
        setLoading(false);
      }
    };

    const init = () => {
      if (!window.google) return;
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: handleCredential,
        locale: i18n.language?.startsWith('en') ? 'en' : 'es',
      });
      if (btnRef.current) {
        btnRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(btnRef.current, {
          theme: 'outline', size: 'large', text: 'continue_with', shape: 'pill', width: 280,
          locale: i18n.language?.startsWith('en') ? 'en' : 'es',
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
  }, [login, i18n.language]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#eaf6fb] via-blue-50 to-[#e6fbfd] flex flex-col items-center justify-center p-4">
      {/* Marca de agua: logo degradado al fondo */}
      <img src="/icono.png" alt="" aria-hidden="true"
        className="pointer-events-none select-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(80vw,560px)] max-w-none opacity-[0.07]" />
      <div className="relative z-10 w-full max-w-sm bg-white rounded-2xl shadow-lg p-8 text-center">
        <img src="/logo.png" alt="odontiacloud" className="h-20 w-auto mx-auto mb-4" />
        <p className="text-sm text-gray-500 mb-6">{t('login.subtitle')}</p>

        <div className="flex flex-col items-center gap-1.5 mb-6">
          <span className="text-xs text-gray-400">{t('login.language')}</span>
          <LanguageToggle />
        </div>

        <div className="flex justify-center min-h-[44px]">
          {!loading && <div ref={btnRef} />}
          {loading && <p className="text-sm text-gray-400">{t('login.signingIn')}</p>}
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-4">{error}</p>}

        <p className="text-xs text-gray-400 mt-6">
          {t('login.accessNote')}
        </p>
      </div>
    </div>
  );
}
