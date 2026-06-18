import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import LanguageToggle from '../components/LanguageToggle';

export default function CreateAccount() {
  const { login } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [checking, setChecking] = useState(true);
  const [invalid, setInvalid] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Verifica el token de invitación y obtiene el correo asociado
  useEffect(() => {
    setChecking(true); setInvalid('');
    if (!token) { setInvalid(t('createAccount.missingToken')); setChecking(false); return; }
    let active = true;
    api.auth.getInvitation(token)
      .then(r => { if (active) setEmail(r.email); })
      .catch(() => { if (active) setInvalid(t('createAccount.invalidLink')); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError(t('createAccount.passwordTooShort')); return; }
    if (password !== confirm) { setError(t('createAccount.passwordMismatch')); return; }
    setSubmitting(true);
    try {
      const lang = i18n.language?.startsWith('en') ? 'en' : 'es';
      const { token: jwt, account } = await api.auth.register(token, name.trim(), password, lang);
      login(jwt, account);
      navigate('/inicio', { replace: true });
    } catch (err: any) {
      setError(err.message || t('createAccount.invalidLink'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#eaf6fb] via-blue-50 to-[#e6fbfd] flex flex-col items-center justify-center p-4">
      {/* Marca de agua: logo degradado al fondo */}
      <img src="/icono.png" alt="" aria-hidden="true"
        className="pointer-events-none select-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(80vw,560px)] max-w-none opacity-[0.07]" />

      <div className="relative z-10 w-full max-w-sm bg-white rounded-2xl shadow-lg p-8">
        <img src="/icono.png" alt="odontiacloud" className="h-20 w-20 object-contain mx-auto mb-4" />

        {checking ? (
          <p className="text-center text-sm text-gray-400 py-4">{t('createAccount.verifying')}</p>
        ) : invalid ? (
          <div className="text-center">
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{invalid}</p>
            <Link to="/" className="inline-block mt-4 text-sm text-blue-600 font-medium hover:underline">
              {t('createAccount.goToLogin')}
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-lg font-bold text-gray-900 text-center">{t('createAccount.title')}</h1>
            <p className="text-sm text-gray-500 text-center mb-5">{t('createAccount.subtitle')}</p>

            <form onSubmit={handleSubmit} className="space-y-3 text-left">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">{t('createAccount.emailLabel')}</label>
                <input type="email" value={email} disabled
                  className="input bg-gray-50 text-gray-500 cursor-not-allowed" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">{t('createAccount.nameLabel')} *</label>
                <input required type="text" className="input" value={name}
                  onChange={e => setName(e.target.value)} placeholder={t('createAccount.namePlaceholder')} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">{t('createAccount.passwordLabel')} *</label>
                <input required type="password" className="input" value={password}
                  onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
                <p className="text-xs text-gray-400 mt-1">{t('createAccount.passwordHint')}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">{t('createAccount.confirmLabel')} *</label>
                <input required type="password" className="input" value={confirm}
                  onChange={e => setConfirm(e.target.value)} autoComplete="new-password" />
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

              <button type="submit" disabled={submitting}
                className="w-full py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
                {submitting ? t('createAccount.creating') : t('createAccount.submit')}
              </button>
            </form>

            <div className="flex flex-col items-center gap-1.5 mt-6">
              <span className="text-xs text-gray-400">{t('login.language')}</span>
              <LanguageToggle />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
