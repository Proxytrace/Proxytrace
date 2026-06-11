/**
 * Persists a Tracey conversation thread in `localStorage`, keyed by user + project so each
 * user's per-project chat survives navigation and reloads. The stored value is an opaque,
 * JSON-serializable snapshot (assistant-ui's `ExportedMessageRepository`); callers own the
 * shape and round-trip it through the runtime's `export()` / `import()`.
 */

const PREFIX = 'proxytrace.tracey.thread';

function storageKey(userKey: string, projectKey: string): string {
  return `${PREFIX}:${userKey}:${projectKey}`;
}

export function loadThread<T = unknown>(userKey: string, projectKey: string): T | null {
  try {
    const raw = localStorage.getItem(storageKey(userKey, projectKey));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveThread<T = unknown>(userKey: string, projectKey: string, value: T): void {
  try {
    localStorage.setItem(storageKey(userKey, projectKey), JSON.stringify(value));
  } catch {
    // Quota or serialization failure: a dropped thread cache is non-fatal.
  }
}

export function clearThread(userKey: string, projectKey: string): void {
  try {
    localStorage.removeItem(storageKey(userKey, projectKey));
  } catch {
    // ignore
  }
}

const AUTO_APPROVE_KEY = 'proxytrace.tracey.autoApprove';

/** The persisted auto-approve preference; defaults to true when unset or storage is unavailable. */
export function loadAutoApprove(): boolean {
  try {
    return localStorage.getItem(AUTO_APPROVE_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function saveAutoApprove(value: boolean): void {
  try {
    localStorage.setItem(AUTO_APPROVE_KEY, String(value));
  } catch {
    // Quota failure: losing the preference is non-fatal.
  }
}
