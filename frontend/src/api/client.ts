import { getAccessToken, notifyUnauthorized } from '../auth/token';
import { showToast } from '../components/ui/Toast';

type ErrorMeta = { status: number; stacktrace?: string; type?: string };

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, { ...init, headers });
  if (res.status === 401) {
    if (token) notifyUnauthorized();
    throw new Error('401 Unauthorized');
  }
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    let stacktrace: string | undefined;
    let type: string | undefined;

    try {
      const body = await res.json();
      if (body?.error?.message) {
        message = body.error.message;
        stacktrace = body.error.stacktrace;
        type = body.error.type;
      }
    } catch {
      const text = await res.text().catch(() => '');
      if (text) message = `${message}: ${text}`;
    }

    const error = new Error(message) as Error & ErrorMeta;
    error.status = res.status;
    error.stacktrace = stacktrace;
    error.type = type;

    const errMessage = message;
    const errStacktrace = stacktrace;
    const errType = type;
    const errUrl = window.location.href;

    showToast(errMessage, 'error', {
      stacktrace: errStacktrace,
      errorType: errType,
      url: errUrl,
      sendReport: async ({ description, timestamp }) => {
        const token = getAccessToken();
        await fetch('/api/errors', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            message: errMessage,
            stacktrace: errStacktrace,
            type: errType,
            url: errUrl,
            description,
            timestamp,
          }),
        }).catch(() => {});
      },
    });

    throw error;
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: 'POST', body: body != null ? JSON.stringify(body) : undefined }),
  put: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: 'PUT', body: body != null ? JSON.stringify(body) : undefined }),
  patch: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: 'PATCH', body: body != null ? JSON.stringify(body) : undefined }),
  del: (url: string) => request<void>(url, { method: 'DELETE' }),
};

export function qs(params: Record<string, unknown>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') p.set(k, String(v));
  }
  const s = p.toString();
  return s ? '?' + s : '';
}
