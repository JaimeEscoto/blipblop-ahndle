import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api, Account, getToken, setToken, clearToken, setUnauthorizedHandler } from '../api/client';
import i18n from '../i18n';

interface AuthState {
  account: Account | null;
  loading: boolean;
  login: (token: string, account: Account) => void;
  logout: () => void;
  setAccountLanguage: (language: 'es' | 'en') => void;
}

// Aplica el idioma de la cuenta a i18next (y a localStorage vía el listener de i18n)
function applyLang(account: Account | null) {
  if (account?.language && i18n.language !== account.language) {
    i18n.changeLanguage(account.language);
  }
}

const AuthCtx = createContext<AuthState>(null as any);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = () => { clearToken(); setAccount(null); };

  useEffect(() => {
    setUnauthorizedHandler(() => setAccount(null));
    // Si hay token guardado, valida la sesión
    if (getToken()) {
      api.auth.me()
        .then(r => {
          // Si estamos navegando dentro de una clínica distinta a la de la
          // sesión guardada, cerramos la sesión: el usuario tendrá que
          // iniciar sesión en esta clínica.
          if (r.clinic && r.account.clinic_id !== null && r.account.clinic_id !== r.clinic.id) {
            clearToken();
            return;
          }
          setAccount(r.account);
          applyLang(r.account);
        })
        .catch(() => clearToken())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = (token: string, acc: Account) => {
    setToken(token);
    setAccount(acc);
    applyLang(acc);
  };

  const setAccountLanguage = (language: 'es' | 'en') => {
    setAccount(prev => prev ? { ...prev, language } : prev);
    i18n.changeLanguage(language);
  };

  return <AuthCtx.Provider value={{ account, loading, login, logout, setAccountLanguage }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
