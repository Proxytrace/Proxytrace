export interface TokenResponse { token: string; expiresAt: string; }
export interface InvitePreview { email: string; role: 'Viewer' | 'Member' | 'Admin'; expiresAt: string; }

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const error: Error & { status?: number } = new Error(`${url} ${res.status}`);
    error.status = res.status;
    throw error;
  }
  return res.json();
}

export const localAuthApi = {
  login: (email: string, password: string) =>
    post<TokenResponse>('/api/auth/login', { email, password }),
  setup: (email: string, password: string) =>
    post<TokenResponse>('/api/auth/setup', { email, password }),
  signup: (token: string, password: string) =>
    post<TokenResponse>('/api/auth/signup', { token, password }),
  fetchInvite: async (token: string): Promise<InvitePreview> => {
    const res = await fetch(`/api/auth/invites/by-token/${encodeURIComponent(token)}`);
    if (res.status === 410) throw new Error('invite-expired');
    if (!res.ok) throw new Error(`invite ${res.status}`);
    return res.json();
  },
};
