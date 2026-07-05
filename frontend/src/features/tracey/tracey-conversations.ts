/**
 * The Tracey **conversation-history** `localStorage` layer, keyed by user + project so each user's
 * per-project chat history survives navigation and reloads. Two key families:
 * - `proxytrace.tracey.conversations:{user}:{project}` — the {@link ConversationIndex} (active
 *   pointer + up to {@link MAX_CONVERSATIONS} metadata records).
 * - `proxytrace.tracey.conversation:{user}:{project}:{id}` — one {@link ConversationSnapshot} per
 *   conversation, in the AI SDK's native `UIMessage` format (round-tripped through the runtime's
 *   `exportExternalState()` / `importExternalState()` — never the plain `export()`/`import()` pair,
 *   whose ThreadMessages reference the AI SDK messages through a Symbol-keyed property that
 *   `JSON.stringify` drops, silently rebuilding an empty chat).
 */

import type { UIMessage } from 'ai';
import { loadThread, clearThread } from './tracey-thread-storage';

/**
 * One stored conversation in the AI SDK's native message format — the JSON-safe shape returned by
 * the runtime's `exportExternalState()` and accepted by `importExternalState()`.
 */
export interface ConversationSnapshot {
  headId?: string | null;
  messages: Array<{ parentId: string | null; message: UIMessage }>;
}

/** The most recent conversations kept per user+project; older ones are evicted (see {@link upsertConversation}). */
export const MAX_CONVERSATIONS = 20;

/** Longest a derived conversation title may be before it is truncated with an ellipsis. */
const TITLE_MAX_LENGTH = 60;

/** Metadata for one stored conversation. The full messages live under a separate snapshot key. */
export interface ConversationMeta {
  id: string;
  /** Auto-derived from the first user message (see {@link deriveConversationTitle}). */
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

/** The per-user+project history index: the active pointer plus the (capped) conversation list. */
export interface ConversationIndex {
  version: 1;
  activeId: string | null;
  items: ConversationMeta[];
}

const INDEX_PREFIX = 'proxytrace.tracey.conversations';
const SNAPSHOT_PREFIX = 'proxytrace.tracey.conversation';

function indexKey(userKey: string, projectKey: string): string {
  return `${INDEX_PREFIX}:${userKey}:${projectKey}`;
}

function snapshotKey(userKey: string, projectKey: string, id: string): string {
  return `${SNAPSHOT_PREFIX}:${userKey}:${projectKey}:${id}`;
}

function emptyIndex(): ConversationIndex {
  return { version: 1, activeId: null, items: [] };
}

function isConversationMeta(value: unknown): value is ConversationMeta {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.title === 'string' &&
    typeof v.createdAt === 'number' &&
    typeof v.updatedAt === 'number' &&
    typeof v.messageCount === 'number'
  );
}

/** Loads the conversation index, returning a safe empty index when absent, corrupt, or unreadable. */
export function loadConversationIndex(userKey: string, projectKey: string): ConversationIndex {
  try {
    const raw = localStorage.getItem(indexKey(userKey, projectKey));
    if (!raw) return emptyIndex();
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return emptyIndex();
    const obj = parsed as Record<string, unknown>;
    if (!Array.isArray(obj.items)) return emptyIndex();
    const items = obj.items.filter(isConversationMeta);
    const activeId = typeof obj.activeId === 'string' ? obj.activeId : null;
    // Drop a dangling active pointer so callers can trust `activeId` names a present item (or null).
    return { version: 1, activeId: items.some(i => i.id === activeId) ? activeId : null, items };
  } catch {
    return emptyIndex();
  }
}

export function saveConversationIndex(userKey: string, projectKey: string, index: ConversationIndex): void {
  try {
    localStorage.setItem(indexKey(userKey, projectKey), JSON.stringify(index));
  } catch {
    // Quota or serialization failure: a dropped index is non-fatal (history is a convenience).
  }
}

/** Points the active-conversation marker at `id` (or clears it), leaving the item list untouched. */
export function setActiveConversation(userKey: string, projectKey: string, id: string | null): void {
  const index = loadConversationIndex(userKey, projectKey);
  index.activeId = id !== null && index.items.some(i => i.id === id) ? id : null;
  saveConversationIndex(userKey, projectKey, index);
}

export function loadConversationSnapshot<T = unknown>(
  userKey: string,
  projectKey: string,
  id: string,
): T | null {
  try {
    const raw = localStorage.getItem(snapshotKey(userKey, projectKey, id));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Writes a conversation snapshot; returns `false` on a quota/serialization failure so the caller can evict + retry. */
export function saveConversationSnapshot<T = unknown>(
  userKey: string,
  projectKey: string,
  id: string,
  value: T,
): boolean {
  try {
    localStorage.setItem(snapshotKey(userKey, projectKey, id), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeConversationSnapshot(userKey: string, projectKey: string, id: string): void {
  try {
    localStorage.removeItem(snapshotKey(userKey, projectKey, id));
  } catch {
    // ignore
  }
}

/**
 * Inserts or updates a conversation's metadata, marks it active, and enforces the
 * {@link MAX_CONVERSATIONS} cap by evicting the oldest conversations (by `updatedAt`). Returns the
 * new index and the ids evicted so the caller can drop their snapshots and sweep their artifacts.
 * The just-upserted conversation carries the newest `updatedAt`, so it is never itself evicted.
 */
export function upsertConversation(
  userKey: string,
  projectKey: string,
  meta: ConversationMeta,
): { index: ConversationIndex; evicted: string[] } {
  const index = loadConversationIndex(userKey, projectKey);
  const existing = index.items.findIndex(i => i.id === meta.id);
  if (existing >= 0) index.items[existing] = meta;
  else index.items.push(meta);

  const evicted: string[] = [];
  if (index.items.length > MAX_CONVERSATIONS) {
    // Always keep the just-upserted conversation (the one in active use), then keep the most
    // recent of the rest; evict the oldest others. Never evicts `meta` even if it is the oldest.
    const others = index.items.filter(i => i.id !== meta.id).sort((a, b) => b.updatedAt - a.updatedAt);
    for (const dropped of others.slice(MAX_CONVERSATIONS - 1)) evicted.push(dropped.id);
    index.items = [meta, ...others.slice(0, MAX_CONVERSATIONS - 1)];
  }

  index.activeId = meta.id;
  saveConversationIndex(userKey, projectKey, index);
  return { index, evicted };
}

/** Removes a conversation's metadata + snapshot, clearing the active pointer if it named this one. */
export function removeConversation(userKey: string, projectKey: string, id: string): ConversationIndex {
  const index = loadConversationIndex(userKey, projectKey);
  index.items = index.items.filter(i => i.id !== id);
  if (index.activeId === id) index.activeId = null;
  saveConversationIndex(userKey, projectKey, index);
  removeConversationSnapshot(userKey, projectKey, id);
  return index;
}

function isTextPart(part: unknown): part is { type: 'text'; text: string } {
  if (typeof part !== 'object' || part === null) return false;
  const p = part as Record<string, unknown>;
  return p.type === 'text' && typeof p.text === 'string';
}

/**
 * Derives a conversation title from the first user message's text (whitespace-collapsed, truncated),
 * falling back to `fallback` when there is no user text yet. Reads both the AI SDK `UIMessage`
 * shape (`parts`) and the legacy assistant-ui thread-message shape (`content`) defensively so a
 * snapshot from another format version can't throw.
 */
export function deriveConversationTitle(snapshot: unknown, fallback: string): string {
  const messages = (snapshot as { messages?: unknown } | null)?.messages;
  if (!Array.isArray(messages)) return fallback;
  for (const entry of messages) {
    const message = (entry as { message?: unknown } | null)?.message;
    if ((message as { role?: unknown } | null)?.role !== 'user') continue;
    const m = message as { parts?: unknown; content?: unknown };
    const parts = Array.isArray(m.parts) ? m.parts : Array.isArray(m.content) ? m.content : null;
    if (!parts) continue;
    const text = parts.filter(isTextPart).map(p => p.text).join(' ').replace(/\s+/g, ' ').trim();
    if (text) return text.length > TITLE_MAX_LENGTH ? `${text.slice(0, TITLE_MAX_LENGTH - 1).trimEnd()}…` : text;
  }
  return fallback;
}

/** Number of messages in a snapshot, read defensively (0 when unreadable). */
export function snapshotMessageCount(snapshot: unknown): number {
  const messages = (snapshot as { messages?: unknown } | null)?.messages;
  return Array.isArray(messages) ? messages.length : 0;
}

/**
 * True when a snapshot is non-empty and in the current AI SDK format (every message carries
 * `parts`). Legacy snapshots from the pre-fix format stored assistant-ui ThreadMessages
 * (`content` shape) whose AI SDK originals were lost to JSON — importing them yields blank
 * messages, so callers skip the restore and start the thread fresh instead.
 */
export function isRestorableSnapshot(snapshot: unknown): boolean {
  const messages = (snapshot as { messages?: unknown } | null)?.messages;
  if (!Array.isArray(messages) || messages.length === 0) return false;
  return messages.every(entry =>
    Array.isArray((entry as { message?: { parts?: unknown } } | null)?.message?.parts),
  );
}

/**
 * One-time migration of the legacy single-thread blob into the conversation-history model. If no
 * index exists yet and a legacy thread with messages is present, it becomes the sole (active)
 * conversation; the legacy key is then removed so this never runs twice. Idempotent, and best-effort
 * — a failure leaves the legacy blob in place rather than losing it. `fallbackTitle` is the localized
 * default used when the legacy thread has no user text.
 */
export function migrateLegacyThread(userKey: string, projectKey: string, fallbackTitle: string): void {
  try {
    const legacy = loadThread(userKey, projectKey);
    const indexExists = localStorage.getItem(indexKey(userKey, projectKey)) !== null;
    if (indexExists || !legacy || snapshotMessageCount(legacy) === 0) {
      // Nothing to fold in (already migrated, or empty/absent legacy). Drop a stale legacy blob.
      if (legacy) clearThread(userKey, projectKey);
      return;
    }
    const id = crypto.randomUUID();
    const now = Date.now();
    const meta: ConversationMeta = {
      id,
      title: deriveConversationTitle(legacy, fallbackTitle),
      createdAt: now,
      updatedAt: now,
      messageCount: snapshotMessageCount(legacy),
    };
    if (!saveConversationSnapshot(userKey, projectKey, id, legacy)) return; // quota: keep legacy blob
    saveConversationIndex(userKey, projectKey, { version: 1, activeId: id, items: [meta] });
    clearThread(userKey, projectKey);
  } catch {
    // Migration is best-effort; a thrown storage error leaves the legacy blob untouched.
  }
}
