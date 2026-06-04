import 'fake-indexeddb/auto';
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  putArtifact,
  getArtifact,
  clearArtifacts,
  storeArtifact,
} from './tracey-artifact-store';

function inMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: (i) => [...map.keys()][i] ?? null,
    get length() { return map.size; },
  };
}

describe('tracey-artifact-store', () => {
  it('round-trips an artifact by id', async () => {
    await putArtifact({ id: 'a1', scope: 'u:p', kind: 'agent', data: { name: 'Bot' } });

    expect(await getArtifact('a1')).toEqual({ name: 'Bot' });
  });

  it('returns null for a missing id', async () => {
    expect(await getArtifact('does-not-exist')).toBeNull();
  });

  it('clears only the given scope', async () => {
    await putArtifact({ id: 'keep', scope: 'u:p2', kind: 'agent', data: { a: 1 } });
    await putArtifact({ id: 'drop', scope: 'u:p1', kind: 'agent', data: { b: 2 } });

    await clearArtifacts('u:p1');

    expect(await getArtifact('drop')).toBeNull();
    expect(await getArtifact('keep')).toEqual({ a: 1 });
  });

  it('storeArtifact persists full data and returns a reference envelope', async () => {
    const full = { items: [1, 2, 3], huge: 'x'.repeat(1000) };
    const envelope = await storeArtifact('u:p', 'agent-list', full, { count: 3 });

    expect(envelope.kind).toBe('agent-list');
    expect(envelope.summary).toEqual({ count: 3 });
    expect(typeof envelope.artifactRef).toBe('string');
    expect(envelope.artifactRef.length).toBeGreaterThan(0);
    expect(await getArtifact(envelope.artifactRef)).toEqual(full);
  });

  it('mints a distinct reference per storeArtifact call', async () => {
    const a = await storeArtifact('u:p', 'k', { v: 1 }, null);
    const b = await storeArtifact('u:p', 'k', { v: 2 }, null);

    expect(a.artifactRef).not.toBe(b.artifactRef);
  });
});

describe('tracey-artifact-store localStorage fallback (IndexedDB unavailable)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('round-trips and scope-clears via localStorage when IndexedDB is absent', async () => {
    const ls = inMemoryStorage();
    const setItem = vi.spyOn(ls, 'setItem');
    vi.stubGlobal('indexedDB', undefined);
    vi.stubGlobal('localStorage', ls);

    await putArtifact({ id: 'ls1', scope: 'u:p1', kind: 'agent', data: { name: 'Local' } });
    expect(setItem).toHaveBeenCalled();
    await putArtifact({ id: 'ls2', scope: 'u:p2', kind: 'agent', data: { name: 'Other' } });

    expect(await getArtifact('ls1')).toEqual({ name: 'Local' });
    expect(await getArtifact('missing')).toBeNull();

    await clearArtifacts('u:p1');
    expect(await getArtifact('ls1')).toBeNull();
    expect(await getArtifact('ls2')).toEqual({ name: 'Other' });
  });

  it('storeArtifact persists to localStorage and returns a reference when IndexedDB is absent', async () => {
    vi.stubGlobal('indexedDB', undefined);
    vi.stubGlobal('localStorage', inMemoryStorage());

    const env = await storeArtifact('u:p', 'agent-list', { items: [1, 2] }, { count: 2 });

    expect(env.summary).toEqual({ count: 2 });
    expect(await getArtifact(env.artifactRef)).toEqual({ items: [1, 2] });
  });
});
