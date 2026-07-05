import { describe, it, expect, beforeEach, vi } from 'vitest';

// The artifact store touches IndexedDB; stub it so these pure history helpers stay unit-testable.
vi.mock('./tracey-artifact-store', () => ({
  collectArtifactRefs: (snapshot: unknown) => {
    const refs = (snapshot as { refs?: string[] } | null)?.refs;
    return Array.isArray(refs) ? refs : [];
  },
  pruneArtifacts: vi.fn(() => Promise.resolve()),
}));

import { loadHistory, unionArtifactRefs, persistConversationSnapshot } from './tracey-history';
import {
  loadConversationIndex,
  loadConversationSnapshot,
  saveConversationIndex,
  MAX_CONVERSATIONS,
  type ConversationSnapshot,
} from './tracey-storage';

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

const USER = 'u@x';
const PROJ = 'proj1';

/** A minimal restorable snapshot whose first user message carries `text`. */
function snapshot(text: string): ConversationSnapshot {
  return {
    headId: 'm1',
    messages: [{ parentId: null, message: { id: 'm1', role: 'user', parts: [{ type: 'text', text }] } }],
  };
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: inMemoryStorage(), writable: true });
});

describe('tracey-history · loadHistory', () => {
  it('returns an empty history when nothing is stored', () => {
    expect(loadHistory(USER, PROJ)).toEqual({ items: [], activeId: null });
  });

  it('folds a legacy single-thread blob into the conversation model', () => {
    localStorage.setItem(`proxytrace.tracey.thread:${USER}:${PROJ}`, JSON.stringify(snapshot('legacy question')));
    const history = loadHistory(USER, PROJ);
    expect(history.items).toHaveLength(1);
    expect(history.activeId).toBe(history.items[0].id);
    expect(history.items[0].title).toBe('legacy question');
    // Legacy blob is consumed by the migration.
    expect(localStorage.getItem(`proxytrace.tracey.thread:${USER}:${PROJ}`)).toBeNull();
  });
});

describe('tracey-history · unionArtifactRefs', () => {
  it('unions the refs across every stored conversation', () => {
    saveConversationIndex(USER, PROJ, {
      version: 1,
      activeId: null,
      items: [
        { id: 'a', title: 'a', createdAt: 1, updatedAt: 1, messageCount: 1 },
        { id: 'b', title: 'b', createdAt: 1, updatedAt: 1, messageCount: 1 },
      ],
    });
    localStorage.setItem(`proxytrace.tracey.conversation:${USER}:${PROJ}:a`, JSON.stringify({ refs: ['r1', 'r2'] }));
    localStorage.setItem(`proxytrace.tracey.conversation:${USER}:${PROJ}:b`, JSON.stringify({ refs: ['r2', 'r3'] }));
    const refs = unionArtifactRefs(USER, PROJ, loadConversationIndex(USER, PROJ).items);
    expect([...refs].sort()).toEqual(['r1', 'r2', 'r3']);
  });
});

describe('tracey-history · persistConversationSnapshot', () => {
  it('writes the snapshot and index without a structural change for a fresh conversation', () => {
    const onQuotaEvict = vi.fn();
    const result = persistConversationSnapshot(USER, PROJ, `${USER}:${PROJ}`, 'c1', snapshot('hi'), 100, 1, onQuotaEvict);

    expect(result.structural).toBe(false);
    expect(onQuotaEvict).not.toHaveBeenCalled();
    expect(result.items.map(i => i.id)).toEqual(['c1']);
    expect(loadConversationSnapshot(USER, PROJ, 'c1')).toEqual(snapshot('hi'));
    const stored = loadConversationIndex(USER, PROJ).items[0];
    expect(stored.title).toBe('hi');
    expect(stored.createdAt).toBe(100);
  });

  it('evicts the oldest conversation (structural) when the cap is exceeded', () => {
    for (let i = 0; i < MAX_CONVERSATIONS; i++) {
      persistConversationSnapshot(USER, PROJ, `${USER}:${PROJ}`, `c${i}`, snapshot(`m${i}`), i + 1, 1, vi.fn());
    }
    const result = persistConversationSnapshot(USER, PROJ, `${USER}:${PROJ}`, 'new', snapshot('newest'), 999, 1, vi.fn());

    expect(result.structural).toBe(true);
    expect(result.items).toHaveLength(MAX_CONVERSATIONS);
    expect(result.items.some(i => i.id === 'new')).toBe(true);
    // Exactly one prior conversation was evicted, and its snapshot blob was swept.
    const seeded = Array.from({ length: MAX_CONVERSATIONS }, (_, i) => `c${i}`);
    const evicted = seeded.filter(id => !result.items.some(i => i.id === id));
    expect(evicted).toHaveLength(1);
    expect(loadConversationSnapshot(USER, PROJ, evicted[0])).toBeNull();
  });
});
