import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { setAccessToken, setUnauthorizedHandler } from "../token";
import LocalAuthContext, {
  decode,
  type LocalAuthContextValue,
} from "./LocalAuthContext";

const STORAGE_KEY = "trsr.token";

export function LocalAuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [token, setTokenState] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEY),
  );

  const setToken = useCallback(
    (t: string | null) => {
      if (t) localStorage.setItem(STORAGE_KEY, t);
      else localStorage.removeItem(STORAGE_KEY);
      setAccessToken(t);
      setTokenState(t);
      queryClient.clear();
    },
    [queryClient],
  );

  useEffect(() => {
    setAccessToken(token);
  }, [token]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null);
      navigate("/login");
    });
    return () => setUnauthorizedHandler(null);
  }, [navigate, setToken]);

  const user = useMemo(() => (token ? decode(token) : null), [token]);

  const value = useMemo<LocalAuthContextValue>(
    () => ({
      isAuthenticated: !!user,
      user,
      setToken,
      signinRedirect: () => navigate("/login"),
      signoutRedirect: () => {
        setToken(null);
        navigate("/login");
      },
    }),
    [user, setToken, navigate],
  );

  return (
    <LocalAuthContext.Provider value={value}>
      {children}
    </LocalAuthContext.Provider>
  );
}
