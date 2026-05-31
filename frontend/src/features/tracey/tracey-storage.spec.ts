import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadThread, saveThread, clearThread } from './tracey-storage';

function inMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() { return map.size; },
  };
}

describe('tracey-storage', () => {
  beforeEach(() => vi.stubGlobal('localStorage', inMemoryStorage()));

  it('round-trips a thread keyed by user + project', () => {
    const messages = [{ role: 'user', text: 'hi' }, { role: 'assistant', text: 'hello' }];
    saveThread('user-1', 'proj-1', messages);

    expect(loadThread('user-1', 'proj-1')).toEqual(messages);
  });

  it('isolates threads per user/project key', () => {
    saveThread('user-1', 'proj-1', [{ a: 1 }]);
    saveThread('user-1', 'proj-2', [{ b: 2 }]);

    expect(loadThread('user-1', 'proj-1')).toEqual([{ a: 1 }]);
    expect(loadThread('user-1', 'proj-2')).toEqual([{ b: 2 }]);
  });

  it('returns an empty array when nothing is stored', () => {
    expect(loadThread('nobody', 'nowhere')).toEqual([]);
  });

  it('clears a stored thread', () => {
    saveThread('user-1', 'proj-1', [{ a: 1 }]);
    clearThread('user-1', 'proj-1');

    expect(loadThread('user-1', 'proj-1')).toEqual([]);
  });

  it('tolerates corrupt stored JSON', () => {
    localStorage.setItem('proxytrace.tracey.thread:user-1:proj-1', '{not json');

    expect(loadThread('user-1', 'proj-1')).toEqual([]);
  });
});
