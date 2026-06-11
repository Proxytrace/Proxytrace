import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadThread, saveThread, clearThread, loadAutoApprove, saveAutoApprove } from './tracey-storage';

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

  it('round-trips a thread snapshot keyed by user + project', () => {
    const snapshot = { messages: [{ role: 'user', text: 'hi' }], headId: 'm1' };
    saveThread('user-1', 'proj-1', snapshot);

    expect(loadThread('user-1', 'proj-1')).toEqual(snapshot);
  });

  it('isolates threads per user/project key', () => {
    saveThread('user-1', 'proj-1', { a: 1 });
    saveThread('user-1', 'proj-2', { b: 2 });

    expect(loadThread('user-1', 'proj-1')).toEqual({ a: 1 });
    expect(loadThread('user-1', 'proj-2')).toEqual({ b: 2 });
  });

  it('returns null when nothing is stored', () => {
    expect(loadThread('nobody', 'nowhere')).toBeNull();
  });

  it('clears a stored thread', () => {
    saveThread('user-1', 'proj-1', { a: 1 });
    clearThread('user-1', 'proj-1');

    expect(loadThread('user-1', 'proj-1')).toBeNull();
  });

  it('tolerates corrupt stored JSON', () => {
    localStorage.setItem('proxytrace.tracey.thread:user-1:proj-1', '{not json');

    expect(loadThread('user-1', 'proj-1')).toBeNull();
  });

  it('defaults auto-approve to true when unset', () => {
    expect(loadAutoApprove()).toBe(true);
  });

  it('round-trips the auto-approve preference', () => {
    saveAutoApprove(false);
    expect(loadAutoApprove()).toBe(false);

    saveAutoApprove(true);
    expect(loadAutoApprove()).toBe(true);
  });
});
