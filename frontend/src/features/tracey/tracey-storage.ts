/**
 * Barrel for Tracey's `localStorage` persistence, kept so consumers import from one place while the
 * implementation is split across cohesive modules:
 * - {@link ./tracey-thread-storage} — the legacy single-thread key + the rail-collapse preference.
 * - {@link ./tracey-conversations} — the conversation-history index and per-conversation snapshots.
 */

export {
  loadThread,
  saveThread,
  clearThread,
  loadRailCollapsed,
  saveRailCollapsed,
} from './tracey-thread-storage';

export {
  MAX_CONVERSATIONS,
  loadConversationIndex,
  saveConversationIndex,
  setActiveConversation,
  loadConversationSnapshot,
  saveConversationSnapshot,
  removeConversationSnapshot,
  upsertConversation,
  removeConversation,
  deriveConversationTitle,
  snapshotMessageCount,
  isRestorableSnapshot,
  migrateLegacyThread,
  type ConversationSnapshot,
  type ConversationMeta,
  type ConversationIndex,
} from './tracey-conversations';
