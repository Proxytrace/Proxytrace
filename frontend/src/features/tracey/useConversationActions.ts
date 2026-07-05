import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { useChatRuntime } from '@assistant-ui/react-ai-sdk';
import {
  loadConversationIndex,
  loadConversationSnapshot,
  setActiveConversation,
  removeConversation,
  isRestorableSnapshot,
  type ConversationSnapshot,
} from './tracey-storage';
import { pruneArtifacts } from './tracey-artifact-store';
import { unionArtifactRefs, type ConversationHistory } from './tracey-history';

interface ConversationActionsParams {
  runtime: ReturnType<typeof useChatRuntime>;
  userKey: string;
  projectKey: string;
  artifactScope: string;
  /** Id of the conversation the runtime currently holds; mutated as threads swap (see {@link useTraceyChat}). */
  activeIdRef: MutableRefObject<string | null>;
  /** `createdAt` of the active conversation, mirrored for the persist closure. */
  createdAtRef: MutableRefObject<number>;
  /** Gates persistence while a thread swap + import is in flight so transient exports can't clobber a snapshot. */
  restoringRef: MutableRefObject<boolean>;
  setHistory: Dispatch<SetStateAction<ConversationHistory>>;
}

export interface ConversationActions {
  /** Archive the current conversation (it stays in history) and switch to a fresh empty thread. */
  startFreshThread: () => Promise<void>;
  /** Fire-and-forget wrapper over {@link startFreshThread} for the rail's "new" button. */
  startNewConversation: () => void;
  /** Load a past conversation into the runtime (view == continue — the user can keep typing). */
  selectConversation: (id: string) => void;
  /** Delete a stored conversation (and its artifacts); falls back to the most recent remaining. */
  deleteConversation: (id: string) => void;
}

/**
 * The conversation-management callbacks for {@link useTraceyChat}: start-fresh, select, and delete.
 * Extracted to keep the hook thin; they mutate the passed refs and `setHistory` exactly as before,
 * so this is behavior-preserving code motion (the restore/persist effect stays in the hook and
 * shares the same refs).
 */
export function useConversationActions(params: ConversationActionsParams): ConversationActions {
  const {
    runtime, userKey, projectKey, artifactScope,
    activeIdRef, createdAtRef, restoringRef, setHistory,
  } = params;

  const startFreshThread = useCallback((): Promise<void> => {
    // The current conversation is already persisted under its id, so it stays in history. Just
    // detach the active pointer and switch to a fresh empty thread; the next message mints a new id.
    restoringRef.current = true;
    activeIdRef.current = null;
    createdAtRef.current = 0;
    setHistory(h => ({ items: h.items, activeId: null }));
    setActiveConversation(userKey, projectKey, null);
    return runtime.threads.switchToNewThread().finally(() => { restoringRef.current = false; });
  }, [runtime, userKey, projectKey, activeIdRef, createdAtRef, restoringRef, setHistory]);

  const startNewConversation = useCallback(() => { void startFreshThread(); }, [startFreshThread]);

  const selectConversation = useCallback((id: string) => {
    if (id === activeIdRef.current) return;
    const meta = loadConversationIndex(userKey, projectKey).items.find(c => c.id === id);
    const snapshot = loadConversationSnapshot<ConversationSnapshot>(userKey, projectKey, id);
    restoringRef.current = true;
    activeIdRef.current = id;
    createdAtRef.current = meta?.createdAt ?? Date.now();
    setHistory(h => ({ items: h.items, activeId: id }));
    setActiveConversation(userKey, projectKey, id);
    // `await switchToNewThread()` BEFORE import — right after a switch the binding can transiently
    // resolve to the empty core, whose import throws. (When the current thread is already the
    // fresh "new" one, switchToNewThread resolves as a no-op and the import lands in it — fine.)
    void runtime.threads
      .switchToNewThread()
      .then(() => {
        if (snapshot && isRestorableSnapshot(snapshot)) {
          try {
            runtime.thread.importExternalState(snapshot);
          } catch {
            // Incompatible snapshot: leave the fresh empty thread.
          }
        }
      })
      .finally(() => { restoringRef.current = false; });
  }, [runtime, userKey, projectKey, activeIdRef, createdAtRef, restoringRef, setHistory]);

  const deleteConversation = useCallback((id: string) => {
    const after = removeConversation(userKey, projectKey, id);
    const wasActive = activeIdRef.current === id;
    setHistory(h => ({ items: after.items, activeId: wasActive ? null : h.activeId }));
    // Sweep the deleted conversation's now-orphaned artifacts (its refs aren't in any survivor).
    void pruneArtifacts(artifactScope, unionArtifactRefs(userKey, projectKey, after.items)).catch(() => {});
    if (wasActive) {
      const next = [...after.items].sort((a, b) => b.updatedAt - a.updatedAt)[0];
      if (next) selectConversation(next.id);
      else startNewConversation();
    }
  }, [userKey, projectKey, artifactScope, activeIdRef, setHistory, selectConversation, startNewConversation]);

  return { startFreshThread, startNewConversation, selectConversation, deleteConversation };
}
