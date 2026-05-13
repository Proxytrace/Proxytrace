import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { setAccessToken, setUnauthorizedHandler } from '../token';

const STORAGE_KEY = 'trsr.token';

export interface LocalUser {
  id: string;
  email: string;
  role: 'Viewer' | 'Member' | 'Admin';
}

interface LocalAuthContextValue {
  isAuthenticated: boolean;
  user: LocalUser | null;
  setToken: (token: string | null) => void;
  signinRedirect: () => void;
  signoutRedirect: () => void;
}

const LocalAuthContext = createContext<LocalAuthContextValue | null>(null);

function decode(token: string): LocalUser | null {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return {
      id: json.sub,
      email: json.email,
      role:
        json['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ??
        json.role ??
        'Viewer',
    };
  } catch {
    return null;
  }
}

export function LocalAuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [token, setTokenState] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));

  const setToken = useCallback((t: string | null) => {
    if (t) localStorage.setItem(STORAGE_KEY, t);
    else localStorage.removeItem(STORAGE_KEY);
    setAccessToken(t);
    setTokenState(t);
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    setAccessToken(token);
  }, [token]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null);
      navigate('/login');
    });
    return () => setUnauthorizedHandler(null);
  }, [navigate, setToken]);

  const user = useMemo(() => (token ? decode(token) : null), [token]);

  const value = useMemo<LocalAuthContextValue>(
    () => ({
      isAuthenticated: !!user,
      user,
      setToken,
      signinRedirect: () => navigate('/login'),
      signoutRedirect: () => {
        setToken(null);
        navigate('/login');
      },
    }),
    [user, setToken, navigate],
  );

  return <LocalAuthContext.Provider value={value}>{children}</LocalAuthContext.Provider>;
}

export function useLocalAuth() {
  const ctx = useContext(LocalAuthContext);
  if (!ctx) throw new Error('useLocalAuth outside LocalAuthProvider');
  return ctx;
}
