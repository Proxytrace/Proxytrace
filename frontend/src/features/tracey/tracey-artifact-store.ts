/**
 * Persists large Tracey tool-result payloads in the browser, keyed by a random reference id.
 * Tools store the full payload here and return only a compact {@link ArtifactEnvelope} to the
 * model (and to the persisted thread snapshot); the inline tool-UI cards resolve the reference
 * back to the full data via `useArtifact`. This keeps big results (agent lists, captured traces,
 * stats series, plot data) out of the model context — they live in the browser instead.
 *
 * Storage is tiered so the token saving survives degraded environments: IndexedDB first (roomy,
 * the normal path), falling back to localStorage when IndexedDB is unavailable (e.g. private
 * browsing in Firefox). Only if both backends fail does the caller (`tracey-tools`) drop to
 * returning the payload inline. Reads check both backends so an artifact written under one path
 * still resolves under the other.
 */

const DB_NAME = 'proxytrace.tracey';
const DB_VERSION = 1;
const STORE = 'artifacts';
const SCOPE_INDEX = 'scope';
const LS_PREFIX = 'proxytrace.tracey.artifact:';

/**
 * A stored payload: the full data plus the scope it belongs to so a thread reset can wipe just
 * that user+project's blobs.
 */
export interface ArtifactRecord {
  id: string;
  scope: string;
  kind: string;
  data: unknown;
}

/**
 * The compact value a store-backed tool returns: a reference into the artifact store plus a
 * small, model-facing digest. The full payload is fetched from the store by the UI, never sent
 * to the model.
 */
export interface ArtifactEnvelope<S = unknown> {
  artifactRef: string;
  kind: string;
  summary: S;
}

/* ── IndexedDB backend ── */

let dbPromise: Promise<IDBDatabase> | null = null;

function idbAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex(SCOPE_INDEX, 'scope', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      // Don't cache a rejected promise: a transient open failure would otherwise wedge the store
      // permanently. Clearing it lets the next call retry.
      dbPromise = null;
      reject(request.error);
    };
  });
  return dbPromise;
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbPut(record: ArtifactRecord): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).put(record);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function idbGet(id: string): Promise<unknown | null> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readonly');
  const record = await promisifyRequest(tx.objectStore(STORE).get(id) as IDBRequest<ArtifactRecord | undefined>);
  return record ? record.data : null;
}

async function idbClear(scope: string, keep?: ReadonlySet<string>): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  const index = tx.objectStore(STORE).index(SCOPE_INDEX);
  const cursorRequest = index.openCursor(IDBKeyRange.only(scope));
  cursorRequest.onsuccess = () => {
    const cursor = cursorRequest.result;
    if (cursor) {
      const id = (cursor.value as ArtifactRecord).id;
      if (!keep || !keep.has(id)) cursor.delete();
      cursor.continue();
    }
  };
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/* ── localStorage backend (fallback) ── */

function lsAvailable(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage !== null;
  } catch {
    return false;
  }
}

function lsPut(record: ArtifactRecord): void {
  localStorage.setItem(LS_PREFIX + record.id, JSON.stringify(record));
}

function lsGet(id: string): unknown | null {
  if (!lsAvailable()) return null;
  const raw = localStorage.getItem(LS_PREFIX + id);
  if (!raw) return null;
  try {
    return (JSON.parse(raw) as ArtifactRecord).data;
  } catch {
    return null;
  }
}

function lsClear(scope: string, keep?: ReadonlySet<string>): void {
  if (!lsAvailable()) return;
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(LS_PREFIX)) continue;
    try {
      const record = JSON.parse(localStorage.getItem(key) ?? '') as ArtifactRecord;
      if (record.scope === scope && (!keep || !keep.has(record.id))) toRemove.push(key);
    } catch {
      // A corrupt entry: drop it too.
      toRemove.push(key);
    }
  }
  for (const key of toRemove) localStorage.removeItem(key);
}

/* ── Tiered public API ── */

/**
 * Writes a full payload, preferring IndexedDB and falling back to localStorage. Throws only when
 * neither backend can store it, so the caller can fall back to an inline result.
 */
export async function putArtifact(record: ArtifactRecord): Promise<void> {
  if (idbAvailable()) {
    try {
      await idbPut(record);
      return;
    } catch {
      // Fall through to localStorage.
    }
  }
  lsPut(record);
}

/**
 * Reads a full payload by reference id, checking IndexedDB then localStorage, or null when it is
 * absent in both (cleared, evicted, or never written).
 */
export async function getArtifact(id: string): Promise<unknown | null> {
  if (idbAvailable()) {
    try {
      const value = await idbGet(id);
      if (value != null) return value;
    } catch {
      // Fall through to localStorage.
    }
  }
  return lsGet(id);
}

async function sweep(scope: string, keep?: ReadonlySet<string>): Promise<void> {
  if (idbAvailable()) {
    try {
      await idbClear(scope, keep);
    } catch {
      // ignore
    }
  }
  try {
    lsClear(scope, keep);
  } catch {
    // ignore
  }
}

/**
 * Deletes every artifact belonging to a scope (a `${userKey}:${projectKey}` string) from both
 * backends, used when a Tracey thread is cleared. Best-effort: failures are swallowed.
 */
export function clearArtifacts(scope: string): Promise<void> {
  return sweep(scope);
}

/**
 * Garbage-collects a scope's artifacts, keeping only those whose id is in {@link keep} (the
 * references the live thread still points at) and deleting the rest. Run at mount against the
 * restored thread's references to dispose of orphans left by a replaced thread, a failed restore,
 * or a write whose thread snapshot never persisted. Best-effort: failures are swallowed.
 */
export function pruneArtifacts(scope: string, keep: ReadonlySet<string>): Promise<void> {
  return sweep(scope, keep);
}

/**
 * Collects every `artifactRef` carried by a persisted thread snapshot (assistant-ui's
 * `ExportedMessageRepository`). Scans the serialized snapshot so it stays decoupled from the exact
 * message-part shape; the references are the set of artifacts the thread still needs.
 */
export function collectArtifactRefs(snapshot: unknown): Set<string> {
  const refs = new Set<string>();
  try {
    const json = JSON.stringify(snapshot);
    const pattern = /"artifactRef":"([^"]+)"/g;
    for (let match = pattern.exec(json); match !== null; match = pattern.exec(json)) {
      refs.add(match[1]);
    }
  } catch {
    // A non-serializable snapshot yields no references (nothing kept) — callers treat that as
    // "prune everything", which is the safe outcome for an unreadable thread.
  }
  return refs;
}

/**
 * Writes a full payload and returns the reference envelope to hand back to the model. The summary
 * is the only part the model sees; the full data is retrievable via {@link getArtifact}.
 */
export async function storeArtifact<S>(
  scope: string,
  kind: string,
  full: unknown,
  summary: S,
): Promise<ArtifactEnvelope<S>> {
  const artifactRef = crypto.randomUUID();
  await putArtifact({ id: artifactRef, scope, kind, data: full });
  return { artifactRef, kind, summary };
}
