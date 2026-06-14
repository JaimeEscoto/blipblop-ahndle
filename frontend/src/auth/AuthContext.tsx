import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api, Account, getToken, setToken, clearToken, setUnauthorizedHandler } from '../api/client';

interface AuthState {
  account: Account | null;
  loading: boolean;
  login: (token: string, account: Account) => void;
  logout: () => void;
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
        .then(r => setAccount(r.account))
        .catch(() => clearToken())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = (token: string, acc: Account) => {
    setToken(token);
    setAccount(acc);
  };

  return <AuthCtx.Provider value={{ account, loading, login, logout }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
