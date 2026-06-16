import { getAccessToken, notifyUnauthorized } from '../auth/token';
import { showToast } from '../components/ui/Toast';

type ErrorMeta = { status: number; stacktrace?: string; type?: string };

/** Error types the backend tags on a 402 Payment Required response. */
export type UpgradeErrorType = 'FeatureNotLicensed' | 'LicenseLimitExceeded';

/**
 * Thrown when the API rejects a request because the current license tier does
 * not permit the feature or has exceeded a usage limit (HTTP 402). Callers can
 * branch on this (e.g. show an upgrade placeholder) instead of the generic
 * error toast, which is intentionally suppressed for these responses.
 */
export class UpgradeRequiredError extends Error {
  readonly status = 402;
  readonly errorType: UpgradeErrorType;

  constructor(message: string, errorType: UpgradeErrorType) {
    super(message);
    this.name = 'UpgradeRequiredError';
    this.errorType = errorType;
  }
}

function isUpgradeErrorType(type: string | undefined): type is UpgradeErrorType {
  return type === 'FeatureNotLicensed' || type === 'LicenseLimitExceeded';
}

/** Per-request behaviour overrides. */
export interface RequestOptions {
  /**
   * HTTP error statuses the caller treats as an expected outcome rather than a failure.
   * The request still rejects (so callers/queries see the error), but no red error toast
   * fires — used e.g. for a 404 when a run has no result for a given test case.
   */
  silentStatuses?: number[];
  /**
   * Aborts the request. Forwarded to `fetch`, so a cancelled caller (e.g. Tracey's `await_actions`
   * poll when the user hits Stop) tears down the in-flight HTTP request instead of letting it run
   * to completion. An aborted fetch rejects with a DOMException whose `name` is `'AbortError'`.
   */
  signal?: AbortSignal;
}

async function request<T>(url: string, init?: RequestInit, opts?: RequestOptions): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, { ...init, headers, signal: opts?.signal ?? init?.signal });
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

    // License gating: a 402 tagged with a licensing error type is not a generic
    // failure — surface it as an UpgradeRequiredError so the UI can route to the
    // upgrade placeholder. Do NOT fire the red error toast for these.
    if (res.status === 402 && isUpgradeErrorType(type)) {
      throw new UpgradeRequiredError(message, type);
    }

    const error = new Error(message) as Error & ErrorMeta;
    error.status = res.status;
    error.stacktrace = stacktrace;
    error.type = type;

    // Expected statuses (e.g. a 404 for a missing fixture) still reject so callers can
    // branch, but must not raise the red error toast.
    if (opts?.silentStatuses?.includes(res.status)) {
      throw error;
    }

    const errMessage = message;
    const errStacktrace = stacktrace;
    const errType = type;
    const errUrl = window.location.href;

    showToast(errMessage, 'error', {
      // Don't surface server stacktraces to users in production builds.
      stacktrace: import.meta.env.DEV ? errStacktrace : undefined,
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
  get: <T>(url: string, opts?: RequestOptions) => request<T>(url, undefined, opts),
  post: <T>(url: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(url, { method: 'POST', body: body != null ? JSON.stringify(body) : undefined }, opts),
  put: <T>(url: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(url, { method: 'PUT', body: body != null ? JSON.stringify(body) : undefined }, opts),
  patch: <T>(url: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(url, { method: 'PATCH', body: body != null ? JSON.stringify(body) : undefined }, opts),
  del: <T = void>(url: string, opts?: RequestOptions) => request<T>(url, { method: 'DELETE' }, opts),
};

export function qs(params: Record<string, unknown>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') p.set(k, String(v));
  }
  const s = p.toString();
  return s ? '?' + s : '';
}
