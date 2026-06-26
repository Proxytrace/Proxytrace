export interface TokenResponse { token: string; expiresAt: string; }
export interface InvitePreview { email: string; role: 'Member' | 'Admin'; expiresAt: string; }
export interface MeResponse { id: string; email: string; role: 'Member' | 'Admin'; }

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
  claimLegacy: (email: string, password: string) =>
    post<TokenResponse>('/api/auth/claim-legacy', { email, password }),
  setup: (email: string, password: string) =>
    post<TokenResponse>('/api/auth/setup', { email, password }),
  signup: (token: string, password: string) =>
    post<TokenResponse>('/api/auth/signup', { token, password }),
  /**
   * Requests a password reset. Resolves on success and is deliberately opaque about whether the
   * email maps to an account (anti-enumeration); only a 429 (rate limited) is surfaced.
   */
  forgotPassword: async (email: string): Promise<void> => {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (res.status === 429) {
      const error: Error & { status?: number } = new Error('forgot-password rate-limited');
      error.status = 429;
      throw error;
    }
    // Any other status is treated as success — never reveal whether the address is registered.
  },
  /** Consumes a reset token and sets a new password; logs the user in (httpOnly cookie + token). */
  resetPassword: (token: string, password: string) =>
    post<TokenResponse>('/api/auth/reset-password', { token, password }),
  /** Who the httpOnly session cookie says we are; rejects (status 401) when signed out. */
  me: async (): Promise<MeResponse> => {
    const res = await fetch('/api/auth/me');
    if (!res.ok) {
      const error: Error & { status?: number } = new Error(`/api/auth/me ${res.status}`);
      error.status = res.status;
      throw error;
    }
    return res.json();
  },
  /** Clears the httpOnly session cookie server-side (the SPA can't touch it itself). */
  logout: async (): Promise<void> => {
    await fetch('/api/auth/logout', { method: 'POST' });
  },
  fetchInvite: async (token: string): Promise<InvitePreview> => {
    const res = await fetch(`/api/auth/invites/by-token/${encodeURIComponent(token)}`);
    if (res.status === 410) throw new Error('invite-expired');
    if (!res.ok) throw new Error(`invite ${res.status}`);
    return res.json();
  },
};
