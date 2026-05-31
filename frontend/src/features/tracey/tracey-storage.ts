/**
 * Persists a Tracey conversation thread in `localStorage`, keyed by user + project so each
 * user's per-project chat survives navigation and reloads. The stored value is an opaque
 * array of runtime messages; callers own the message shape.
 */

const PREFIX = 'proxytrace.tracey.thread';

function storageKey(userKey: string, projectKey: string): string {
  return `${PREFIX}:${userKey}:${projectKey}`;
}

export function loadThread<T = unknown>(userKey: string, projectKey: string): T[] {
  try {
    const raw = localStorage.getItem(storageKey(userKey, projectKey));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function saveThread<T = unknown>(userKey: string, projectKey: string, messages: T[]): void {
  try {
    localStorage.setItem(storageKey(userKey, projectKey), JSON.stringify(messages));
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
