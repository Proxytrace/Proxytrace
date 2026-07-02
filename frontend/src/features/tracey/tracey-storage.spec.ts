import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadThread,
  saveThread,
  clearThread,
  loadRailCollapsed,
  saveRailCollapsed,
  loadConversationIndex,
  saveConversationIndex,
  setActiveConversation,
  loadConversationSnapshot,
  saveConversationSnapshot,
  removeConversationSnapshot,
  upsertConversation,
  removeConversation,
  deriveConversationTitle,
  isRestorableSnapshot,
  snapshotMessageCount,
  migrateLegacyThread,
  MAX_CONVERSATIONS,
  type ConversationMeta,
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

/** A minimal `ExportedMessageRepository`-shaped snapshot whose first message is from `role`. */
function snapshotWith(parts: Array<{ role: string; text?: string }>): unknown {
  return {
    headId: 'head',
    messages: parts.map((p, i) => ({
      parentId: i === 0 ? null : `m${i - 1}`,
      message: { id: `m${i}`, role: p.role, content: p.text === undefined ? [] : [{ type: 'text', text: p.text }] },
    })),
  };
}

function meta(over: Partial<ConversationMeta> & { id: string }): ConversationMeta {
  return { title: over.id, createdAt: 1, updatedAt: 1, messageCount: 1, ...over };
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

  it('defaults the rail-collapsed preference to true when unset', () => {
    expect(loadRailCollapsed()).toBe(true);
  });

  it('round-trips the rail-collapsed preference', () => {
    saveRailCollapsed(false);
    expect(loadRailCollapsed()).toBe(false);

    saveRailCollapsed(true);
    expect(loadRailCollapsed()).toBe(true);
  });
});

describe('tracey-storage · conversation index', () => {
  beforeEach(() => vi.stubGlobal('localStorage', inMemoryStorage()));

  it('returns a safe empty index when nothing is stored', () => {
    expect(loadConversationIndex('u', 'p')).toEqual({ version: 1, activeId: null, items: [] });
  });

  it('round-trips an index and isolates it per user/project', () => {
    const index = { version: 1 as const, activeId: 'a', items: [meta({ id: 'a' })] };
    saveConversationIndex('u', 'p1', index);
    expect(loadConversationIndex('u', 'p1')).toEqual(index);
    expect(loadConversationIndex('u', 'p2').items).toEqual([]);
  });

  it('tolerates corrupt stored JSON', () => {
    localStorage.setItem('proxytrace.tracey.conversations:u:p', '{not json');
    expect(loadConversationIndex('u', 'p').items).toEqual([]);
  });

  it('drops a dangling activeId that names no present item', () => {
    saveConversationIndex('u', 'p', { version: 1, activeId: 'ghost', items: [meta({ id: 'real' })] });
    expect(loadConversationIndex('u', 'p').activeId).toBeNull();
  });

  it('filters out malformed item entries', () => {
    localStorage.setItem(
      'proxytrace.tracey.conversations:u:p',
      JSON.stringify({ version: 1, activeId: null, items: [meta({ id: 'ok' }), { id: 'bad' }] }),
    );
    expect(loadConversationIndex('u', 'p').items.map(i => i.id)).toEqual(['ok']);
  });

  it('setActiveConversation points at a present item, else clears it', () => {
    saveConversationIndex('u', 'p', { version: 1, activeId: null, items: [meta({ id: 'a' })] });
    setActiveConversation('u', 'p', 'a');
    expect(loadConversationIndex('u', 'p').activeId).toBe('a');
    setActiveConversation('u', 'p', 'missing');
    expect(loadConversationIndex('u', 'p').activeId).toBeNull();
  });
});

describe('tracey-storage · conversation snapshots', () => {
  beforeEach(() => vi.stubGlobal('localStorage', inMemoryStorage()));

  it('round-trips a snapshot and removes it', () => {
    const snap = snapshotWith([{ role: 'user', text: 'hi' }]);
    expect(saveConversationSnapshot('u', 'p', 'c1', snap)).toBe(true);
    expect(loadConversationSnapshot('u', 'p', 'c1')).toEqual(snap);
    removeConversationSnapshot('u', 'p', 'c1');
    expect(loadConversationSnapshot('u', 'p', 'c1')).toBeNull();
  });

  it('returns false when a write throws (quota)', () => {
    const storage = inMemoryStorage();
    vi.stubGlobal('localStorage', {
      ...storage,
      setItem: () => { throw new DOMException('QuotaExceededError'); },
    });
    expect(saveConversationSnapshot('u', 'p', 'c1', { messages: [] })).toBe(false);
  });
});

describe('tracey-storage · upsert & eviction', () => {
  beforeEach(() => vi.stubGlobal('localStorage', inMemoryStorage()));

  it('inserts a new conversation and marks it active', () => {
    const { index, evicted } = upsertConversation('u', 'p', meta({ id: 'c1', updatedAt: 5 }));
    expect(index.items.map(i => i.id)).toEqual(['c1']);
    expect(index.activeId).toBe('c1');
    expect(evicted).toEqual([]);
  });

  it('updates an existing conversation in place without duplicating', () => {
    upsertConversation('u', 'p', meta({ id: 'c1', title: 'first', updatedAt: 1 }));
    const { index } = upsertConversation('u', 'p', meta({ id: 'c1', title: 'renamed', updatedAt: 9, messageCount: 4 }));
    expect(index.items).toHaveLength(1);
    expect(index.items[0]).toMatchObject({ id: 'c1', title: 'renamed', updatedAt: 9, messageCount: 4 });
  });

  it(`evicts the oldest conversation past the cap of ${MAX_CONVERSATIONS}`, () => {
    for (let i = 1; i <= MAX_CONVERSATIONS; i++) {
      upsertConversation('u', 'p', meta({ id: `c${i}`, updatedAt: i }));
    }
    // The 21st insert overflows: the oldest (c1, updatedAt 1) is evicted.
    const { index, evicted } = upsertConversation('u', 'p', meta({ id: 'c21', updatedAt: 99 }));
    expect(evicted).toEqual(['c1']);
    expect(index.items).toHaveLength(MAX_CONVERSATIONS);
    expect(index.items.some(i => i.id === 'c1')).toBe(false);
    expect(index.items.some(i => i.id === 'c21')).toBe(true);
  });

  it('never evicts the just-upserted conversation even if it has the oldest timestamp', () => {
    for (let i = 1; i <= MAX_CONVERSATIONS; i++) {
      upsertConversation('u', 'p', meta({ id: `c${i}`, updatedAt: i + 100 }));
    }
    const { index, evicted } = upsertConversation('u', 'p', meta({ id: 'fresh', updatedAt: 1 }));
    expect(evicted).not.toContain('fresh');
    expect(index.items.some(i => i.id === 'fresh')).toBe(true);
  });
});

describe('tracey-storage · removeConversation', () => {
  beforeEach(() => vi.stubGlobal('localStorage', inMemoryStorage()));

  it('drops the metadata + snapshot and clears the active pointer when it matched', () => {
    upsertConversation('u', 'p', meta({ id: 'c1' }));
    saveConversationSnapshot('u', 'p', 'c1', snapshotWith([{ role: 'user', text: 'x' }]));
    setActiveConversation('u', 'p', 'c1');

    const after = removeConversation('u', 'p', 'c1');
    expect(after.items).toEqual([]);
    expect(after.activeId).toBeNull();
    expect(loadConversationSnapshot('u', 'p', 'c1')).toBeNull();
  });

  it('keeps the active pointer when a different conversation is removed', () => {
    upsertConversation('u', 'p', meta({ id: 'c1' }));
    upsertConversation('u', 'p', meta({ id: 'c2' })); // c2 becomes active
    const after = removeConversation('u', 'p', 'c1');
    expect(after.activeId).toBe('c2');
    expect(after.items.map(i => i.id)).toEqual(['c2']);
  });
});

describe('tracey-storage · deriveConversationTitle & snapshotMessageCount', () => {
  it('derives the title from the first user message text', () => {
    const snap = snapshotWith([{ role: 'user', text: 'Plot token usage per agent' }, { role: 'assistant', text: 'ok' }]);
    expect(deriveConversationTitle(snap, 'fallback')).toBe('Plot token usage per agent');
  });

  it('skips a leading assistant/system message', () => {
    const snap = snapshotWith([{ role: 'system', text: 'sys' }, { role: 'user', text: 'hello there' }]);
    expect(deriveConversationTitle(snap, 'fallback')).toBe('hello there');
  });

  it('collapses whitespace and truncates long titles with an ellipsis', () => {
    const long = 'a'.repeat(80);
    const snap = snapshotWith([{ role: 'user', text: `  ${long}  ` }]);
    const title = deriveConversationTitle(snap, 'fallback');
    expect(title.endsWith('…')).toBe(true);
    expect(title.length).toBeLessThanOrEqual(60);
  });

  it('falls back when there is no user text or the snapshot is malformed', () => {
    expect(deriveConversationTitle(snapshotWith([{ role: 'assistant', text: 'hi' }]), 'fallback')).toBe('fallback');
    expect(deriveConversationTitle({ messages: 'nope' }, 'fallback')).toBe('fallback');
    expect(deriveConversationTitle(null, 'fallback')).toBe('fallback');
  });

  it('counts messages defensively', () => {
    expect(snapshotMessageCount(snapshotWith([{ role: 'user', text: 'a' }, { role: 'assistant', text: 'b' }]))).toBe(2);
    expect(snapshotMessageCount(null)).toBe(0);
    expect(snapshotMessageCount({ messages: {} })).toBe(0);
  });

  it('derives the title from an AI SDK (`parts`) snapshot', () => {
    const snap = {
      headId: 'm1',
      messages: [{ parentId: null, message: { id: 'm1', role: 'user', parts: [{ type: 'text', text: 'parts title' }] } }],
    };
    expect(deriveConversationTitle(snap, 'fallback')).toBe('parts title');
  });
});

describe('tracey-storage · isRestorableSnapshot', () => {
  it('accepts a non-empty AI SDK snapshot (all messages carry parts)', () => {
    const snap = {
      headId: 'm1',
      messages: [{ parentId: null, message: { id: 'm1', role: 'user', parts: [{ type: 'text', text: 'hi' }] } }],
    };
    expect(isRestorableSnapshot(snap)).toBe(true);
  });

  it('rejects legacy (content-shaped), empty, and malformed snapshots', () => {
    expect(isRestorableSnapshot(snapshotWith([{ role: 'user', text: 'legacy' }]))).toBe(false);
    expect(isRestorableSnapshot({ headId: null, messages: [] })).toBe(false);
    expect(isRestorableSnapshot({ messages: 'nope' })).toBe(false);
    expect(isRestorableSnapshot(null)).toBe(false);
  });
});

describe('tracey-storage · migrateLegacyThread', () => {
  beforeEach(() => vi.stubGlobal('localStorage', inMemoryStorage()));

  it('folds a legacy thread into the conversation model and removes the legacy key', () => {
    const legacy = snapshotWith([{ role: 'user', text: 'legacy chat' }, { role: 'assistant', text: 'reply' }]);
    saveThread('u', 'p', legacy);

    migrateLegacyThread('u', 'p', 'New conversation');

    const index = loadConversationIndex('u', 'p');
    expect(index.items).toHaveLength(1);
    expect(index.activeId).toBe(index.items[0].id);
    expect(index.items[0]).toMatchObject({ title: 'legacy chat', messageCount: 2 });
    expect(loadConversationSnapshot('u', 'p', index.items[0].id)).toEqual(legacy);
    expect(loadThread('u', 'p')).toBeNull(); // legacy key removed
  });

  it('is idempotent: a second run with an existing index changes nothing', () => {
    saveThread('u', 'p', snapshotWith([{ role: 'user', text: 'legacy chat' }]));
    migrateLegacyThread('u', 'p', 'New conversation');
    const first = loadConversationIndex('u', 'p');

    migrateLegacyThread('u', 'p', 'New conversation');
    expect(loadConversationIndex('u', 'p')).toEqual(first);
  });

  it('drops a stray legacy key when an index already exists', () => {
    saveConversationIndex('u', 'p', { version: 1, activeId: null, items: [] });
    saveThread('u', 'p', snapshotWith([{ role: 'user', text: 'orphan' }]));

    migrateLegacyThread('u', 'p', 'New conversation');
    expect(loadThread('u', 'p')).toBeNull();
    expect(loadConversationIndex('u', 'p').items).toEqual([]);
  });

  it('no-ops on an empty or absent legacy thread', () => {
    migrateLegacyThread('u', 'p', 'New conversation');
    expect(loadConversationIndex('u', 'p').items).toEqual([]);

    saveThread('u', 'p', { headId: null, messages: [] });
    migrateLegacyThread('u', 'p', 'New conversation');
    expect(loadConversationIndex('u', 'p').items).toEqual([]);
    expect(loadThread('u', 'p')).toBeNull(); // empty legacy blob swept
  });
});
