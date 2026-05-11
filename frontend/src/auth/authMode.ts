import { useQuery } from '@tanstack/react-query';

export type AuthMode = 'oidc' | 'local';
export interface AuthModeResponse {
  mode: AuthMode;
  setupRequired: boolean;
}

export async function fetchAuthMode(): Promise<AuthModeResponse> {
  const res = await fetch('/api/auth/mode');
  if (!res.ok) throw new Error(`/api/auth/mode failed: ${res.status}`);
  return res.json();
}

export function useAuthMode() {
  return useQuery({
    queryKey: ['auth-mode'],
    queryFn: fetchAuthMode,
    staleTime: Infinity,
  });
}
