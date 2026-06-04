/**
 * Persists large Tracey tool-result payloads in IndexedDB, keyed by a random reference id.
 * Tools store the full payload here and return only a compact {@link ArtifactEnvelope} to the
 * model (and to the persisted thread snapshot); the inline tool-UI cards resolve the reference
 * back to the full data via `useArtifact`. This keeps big results (agent lists, captured traces,
 * stats series, plot data) out of the model context — they live in the browser instead.
 *
 * All operations are best-effort: a failed read/write degrades to a missing artifact (the card
 * shows its empty/error state) rather than throwing into the chat runtime, matching the
 * swallow-and-continue posture of `tracey-storage.ts`.
 */

const DB_NAME = 'proxytrace.tracey';
const DB_VERSION = 1;
const STORE = 'artifacts';
const SCOPE_INDEX = 'scope';

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

let dbPromise: Promise<IDBDatabase> | null = null;

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
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Writes a full payload to the store under its id.
 */
export async function putArtifact(record: ArtifactRecord): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).put(record);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/**
 * Reads a full payload by reference id, or null when it is absent (cleared, evicted, or never
 * written).
 */
export async function getArtifact(id: string): Promise<unknown | null> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readonly');
  const record = await promisifyRequest(tx.objectStore(STORE).get(id) as IDBRequest<ArtifactRecord | undefined>);
  return record ? record.data : null;
}

/**
 * Deletes every artifact belonging to a scope (a `${userKey}:${projectKey}` string), used when a
 * Tracey thread is cleared.
 */
export async function clearArtifacts(scope: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  const index = tx.objectStore(STORE).index(SCOPE_INDEX);
  const cursorRequest = index.openCursor(IDBKeyRange.only(scope));
  cursorRequest.onsuccess = () => {
    const cursor = cursorRequest.result;
    if (cursor) {
      cursor.delete();
      cursor.continue();
    }
  };
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
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
