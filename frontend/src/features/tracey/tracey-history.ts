/**
 * Pure (non-React) conversation-history helpers for {@link useTraceyChat}: loading the stored
 * history for a user+project (folding in any legacy blob) and computing the artifact-reference
 * union across every stored conversation. Kept out of the hook so the hook stays thin and these
 * can be unit-tested without React.
 */

import {
  loadConversationIndex,
  loadConversationSnapshot,
  saveConversationSnapshot,
  removeConversationSnapshot,
  upsertConversation,
  removeConversation,
  deriveConversationTitle,
  migrateLegacyThread,
  type ConversationMeta,
  type ConversationSnapshot,
} from './tracey-storage';
import { collectArtifactRefs, pruneArtifacts } from './tracey-artifact-store';

/** The active conversation pointer plus the (capped) conversation list held in the rail. */
export interface ConversationHistory {
  items: ConversationMeta[];
  activeId: string | null;
}

/** Union of the artifact references across every stored conversation (shared artifact scope). */
export function unionArtifactRefs(userKey: string, projectKey: string, items: ConversationMeta[]): Set<string> {
  const refs = new Set<string>();
  for (const item of items) {
    const snapshot = loadConversationSnapshot(userKey, projectKey, item.id);
    if (snapshot) for (const ref of collectArtifactRefs(snapshot)) refs.add(ref);
  }
  return refs;
}

/**
 * Folds any legacy single-thread blob into the conversation model (idempotent) and loads the
 * stored history for a user+project. Titles are stored with an empty fallback; the rail localizes
 * an empty title at render, so this layer needs no i18n.
 */
export function loadHistory(userKey: string, projectKey: string): ConversationHistory {
  migrateLegacyThread(userKey, projectKey, '');
  const index = loadConversationIndex(userKey, projectKey);
  return { items: index.items, activeId: index.activeId };
}

/**
 * Persists a conversation snapshot for `id` and updates its metadata in the index, enforcing the
 * conversation cap. On a quota failure it evicts the oldest OTHER conversation (reporting the
 * surviving items via `onQuotaEvict` so the caller can refresh the rail without dropping the active
 * pointer) and retries the write once; evicted snapshots' artifacts are re-pruned against the
 * remaining union. Returns the resulting item list and whether the conversation set changed
 * structurally (a new/evicted entry — the only case that needs a rail re-render). Pure of React.
 */
export function persistConversationSnapshot(
  userKey: string,
  projectKey: string,
  artifactScope: string,
  id: string,
  snapshot: ConversationSnapshot,
  createdAt: number,
  count: number,
  onQuotaEvict: (items: ConversationMeta[]) => void,
): { items: ConversationMeta[]; structural: boolean } {
  if (!saveConversationSnapshot(userKey, projectKey, id, snapshot)) {
    // Quota: evict the oldest OTHER conversation, then retry the write once.
    const oldest = loadConversationIndex(userKey, projectKey).items
      .filter(i => i.id !== id)
      .sort((a, b) => a.updatedAt - b.updatedAt)[0];
    if (oldest) {
      const after = removeConversation(userKey, projectKey, oldest.id);
      onQuotaEvict(after.items);
      void pruneArtifacts(artifactScope, unionArtifactRefs(userKey, projectKey, after.items)).catch(() => {});
    }
    saveConversationSnapshot(userKey, projectKey, id, snapshot);
  }

  const meta: ConversationMeta = {
    id,
    title: deriveConversationTitle(snapshot, ''),
    createdAt: createdAt || Date.now(),
    updatedAt: Date.now(),
    messageCount: count,
  };
  const { index: nextIndex, evicted } = upsertConversation(userKey, projectKey, meta);
  for (const evictedId of evicted) removeConversationSnapshot(userKey, projectKey, evictedId);
  if (evicted.length) {
    void pruneArtifacts(artifactScope, unionArtifactRefs(userKey, projectKey, nextIndex.items)).catch(() => {});
  }
  return { items: nextIndex.items, structural: evicted.length > 0 };
}
