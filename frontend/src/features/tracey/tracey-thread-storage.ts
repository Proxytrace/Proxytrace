/**
 * The legacy single-thread `localStorage` layer plus the conversation-rail collapse preference.
 * The thread key (`loadThread`/`saveThread`/`clearThread`) predates the conversation-history model
 * and is kept only so {@link migrateLegacyThread} (in `tracey-conversations.ts`) can fold a
 * pre-history conversation into it. New code uses the conversation history, not these.
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

const RAIL_COLLAPSED_KEY = 'proxytrace.tracey.railCollapsed';

/** The persisted conversation-rail collapse preference; defaults to collapsed (true). */
export function loadRailCollapsed(): boolean {
  try {
    return localStorage.getItem(RAIL_COLLAPSED_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function saveRailCollapsed(value: boolean): void {
  try {
    localStorage.setItem(RAIL_COLLAPSED_KEY, String(value));
  } catch {
    // Quota failure: losing the preference is non-fatal.
  }
}
