import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useChatRuntime } from '@assistant-ui/react-ai-sdk';
import { lastAssistantMessageIsCompleteWithToolCalls } from 'ai';
import type {
  ChatTransport,
  UIMessage,
  UIMessageChunk,
} from 'ai';
import { traceyApi, type TraceySessionDto } from '../../api/tracey';
import { useFeature } from '../../api/license';
import { QUERY_KEYS } from '../../api/query-keys';
import useCurrentProject from '../../hooks/useCurrentProject';
import { useCurrentUser } from '../../auth/useCurrentUser';
import { useKiosk } from '../../contexts/KioskContext';
import { TRACEY_SYSTEM_PROMPT } from './tracey-prompt';
import { TraceyTransport } from './tracey-runtime';
import type { TraceyToolContext } from './tracey-tools';
import {
  loadConversationIndex,
  loadConversationSnapshot,
  saveConversationSnapshot,
  removeConversationSnapshot,
  setActiveConversation,
  upsertConversation,
  removeConversation,
  deriveConversationTitle,
  isRestorableSnapshot,
  migrateLegacyThread,
  type ConversationMeta,
  type ConversationSnapshot,
} from './tracey-storage';
import { collectArtifactRefs, pruneArtifacts } from './tracey-artifact-store';

/** Union of the artifact references across every stored conversation (shared artifact scope). */
function unionArtifactRefs(userKey: string, projectKey: string, items: ConversationMeta[]): Set<string> {
  const refs = new Set<string>();
  for (const item of items) {
    const snapshot = loadConversationSnapshot(userKey, projectKey, item.id);
    if (snapshot) for (const ref of collectArtifactRefs(snapshot)) refs.add(ref);
  }
  return refs;
}

interface ConversationHistory {
  items: ConversationMeta[];
  activeId: string | null;
}

/**
 * Folds any legacy single-thread blob into the conversation model (idempotent) and loads the
 * stored history for a user+project. Titles are stored with an empty fallback; the rail localizes
 * an empty title at render, so this layer needs no i18n.
 */
function loadHistory(userKey: string, projectKey: string): ConversationHistory {
  migrateLegacyThread(userKey, projectKey, '');
  const index = loadConversationIndex(userKey, projectKey);
  return { items: index.items, activeId: index.activeId };
}

/**
 * A {@link ChatTransport} that forwards to a swappable inner transport. The runtime is created
 * once (hooks can't be conditional), but the real proxy-backed transport only exists after the
 * session resolves; until then sends reject.
 */
class DelegatingTransport implements ChatTransport<UIMessage> {
  private inner: ChatTransport<UIMessage> | null = null;

  setInner(inner: ChatTransport<UIMessage> | null): void {
    this.inner = inner;
  }

  sendMessages(
    options: Parameters<ChatTransport<UIMessage>['sendMessages']>[0],
  ): Promise<ReadableStream<UIMessageChunk>> {
    if (!this.inner) return Promise.reject(new Error('Tracey session not ready'));
    return this.inner.sendMessages(options);
  }

  reconnectToStream(
    options: Parameters<ChatTransport<UIMessage>['reconnectToStream']>[0],
  ): Promise<ReadableStream<UIMessageChunk> | null> {
    return this.inner?.reconnectToStream(options) ?? Promise.resolve(null);
  }
}

export interface TraceyChat {
  runtime: ReturnType<typeof useChatRuntime>;
  status: 'no-project' | 'loading' | 'error' | 'ready';
  /** The stored conversation history for the current user+project, newest activity first is up to the view. */
  conversations: ConversationMeta[];
  /** Id of the conversation currently loaded in the runtime, or `null` for a fresh unsaved one. */
  activeConversationId: string | null;
  /** Load a past conversation into the runtime (view == continue — the user can keep typing). */
  selectConversation: (id: string) => void;
  /** Delete a stored conversation (and its artifacts); falls back to the most recent remaining. */
  deleteConversation: (id: string) => void;
  /** Archive the current conversation (it stays in history) and switch to a fresh empty thread. */
  startNewConversation: () => void;
  /** Client-side route change (used by entity-card tool UIs). */
  navigate: (path: string) => void;
  /**
   * Provision the Tracey session (model + agent). The runtime is built app-wide so the
   * conversation survives navigation, but the session — which has backend side effects
   * (agent provisioning) — is only created once the user actually opens Tracey. Idempotent;
   * the page calls it on mount and the session then stays alive across navigation.
   */
  activate: () => void;
}

export function useTraceyChat(): TraceyChat {
  const navigate = useNavigate();
  const { currentProject } = useCurrentProject();
  const currentUser = useCurrentUser();
  // Tracey makes real LLM calls; in kiosk she's only available when an LLM endpoint is configured.
  // Since the runtime mounts app-wide (above the router), gate the session here so it's only
  // provisioned when Tracey is actually available.
  const { interactive } = useKiosk();
  // Tracey is an Enterprise feature; on a Free install the session endpoint 402s, so never fire it.
  const traceyLicensed = useFeature('Tracey');
  // The runtime mounts app-wide, but the session (and its backend agent provisioning) is only
  // created once the user opens Tracey. Latched on, so it stays alive across navigation.
  const [activated, setActivated] = useState(false);
  const activate = useCallback(() => setActivated(true), []);
  const projectId = currentProject?.id;
  const userKey = currentUser?.email ?? 'anon';
  const projectKey = projectId ?? 'none';
  // Artifact scope is per user+project and SHARED across that project's conversations (artifact
  // refs are globally unique, so there is no cross-conversation collision). Keeping it stable means
  // the tool context / transport are not rebuilt when the user switches conversation, and mount
  // pruning must keep the UNION of every conversation's refs (see the restore effect below).
  const artifactScope = `${userKey}:${projectKey}`;

  // Conversation history for the rail, read from localStorage and re-read on user/project change
  // via the render-time pattern (pages don't remount on a project switch — see useTraceFilters).
  // `activeIdRef`/`createdAtRef` mirror the active conversation for the persist closure;
  // `restoringRef` gates persistence while we swap threads + import so the transient empty-thread /
  // import notifications can't clobber a stored snapshot.
  const scopeKey = `${userKey}:${projectKey}`;
  const [history, setHistory] = useState<ConversationHistory>(() => loadHistory(userKey, projectKey));
  const [trackedScope, setTrackedScope] = useState(scopeKey);
  if (scopeKey !== trackedScope) {
    setTrackedScope(scopeKey);
    setHistory(loadHistory(userKey, projectKey));
  }
  const conversations = history.items;
  const activeConversationId = history.activeId;
  const activeIdRef = useRef<string | null>(null);
  const createdAtRef = useRef<number>(0);
  const restoringRef = useRef(false);

  // Write tools are always auto-approved. The `confirm` seam stays in the tool layer (every
  // write still calls it before mutating) so a confirmation gate can be reintroduced there —
  // never in the model — if it's ever needed again.
  const confirm = useCallback(() => Promise.resolve(true), []);

  const { data: session, status: queryStatus } = useQuery<TraceySessionDto>({
    queryKey: QUERY_KEYS.traceySession(projectId),
    queryFn: () => traceyApi.getSession(projectId),
    enabled: !!projectId && interactive && traceyLicensed && activated,
    // Refresh comfortably before the 1-hour key expiry.
    staleTime: 50 * 60 * 1000,
    refetchInterval: 50 * 60 * 1000,
    // This hook is mounted app-wide (in Shell, above the router), so a failed session must not
    // bubble to an ErrorBoundary and crash the shell on every page. The 'error' status is
    // surfaced as a contained empty state on the Tracey page instead (see TraceyAI).
    throwOnError: false,
  });

  const transport = useMemo(() => new DelegatingTransport(), []);
  // `ask_questions` is a human-in-the-loop tool with no `execute`: the model emits the call and
  // the widget supplies the answers via `addResult`. This makes the runtime auto-resubmit once the
  // pending tool call has its result, so the model continues the same turn (no extra user message).
  const runtime = useChatRuntime({
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  });

  const toolContext = useMemo<TraceyToolContext>(
    () => ({ projectId, artifactScope, navigate, confirm, loadedSkillIds: new Set<string>() }),
    [projectId, artifactScope, navigate, confirm],
  );

  // Swap in the real same-origin transport whenever the session (or tool context) changes.
  useEffect(() => {
    transport.setInner(
      session && projectId
        ? new TraceyTransport(projectId, session.model, toolContext, TRACEY_SYSTEM_PROMPT)
        : null,
    );
  }, [transport, session, projectId, toolContext]);

  // Conversation restore + persistence. Re-runs on user/project change (pages don't remount on a
  // project switch), so switching projects restores that project's active thread. The subscription
  // is set up last; the restore runs first (guarded) so its notifications don't persist. Display
  // state is owned by the render-time read above — this effect only touches the runtime + refs and
  // pushes structural updates back through `setHistory` from the (subscription) persist callback.
  useEffect(() => {
    const thread = runtime.thread;
    const index = loadConversationIndex(userKey, projectKey);
    activeIdRef.current = index.activeId;
    const activeMeta = index.activeId ? index.items.find(i => i.id === index.activeId) : undefined;
    createdAtRef.current = activeMeta?.createdAt ?? 0;

    // Prune artifacts against the UNION of every conversation's refs, not just the active one —
    // they share one scope, so an active-only prune would delete the other conversations' charts.
    // Mount-only (the set is stable here); pruning mid-stream could race a just-written blob.
    void pruneArtifacts(artifactScope, unionArtifactRefs(userKey, projectKey, index.items)).catch(() => {});

    // Restore the active conversation. Snapshots round-trip via export/importExternalState — the
    // JSON-safe AI SDK message format; the plain export()/import() pair loses the Symbol-linked AI
    // SDK messages in JSON, leaving an imported thread that renders empty. The import replaces the
    // thread, so it also clears a previous project's messages on a project switch; when there is
    // nothing to restore we switch to a fresh thread to clear. Guard persistence for the whole restore.
    restoringRef.current = true;
    const saved = index.activeId
      ? loadConversationSnapshot<ConversationSnapshot>(userKey, projectKey, index.activeId)
      : null;
    if (saved && isRestorableSnapshot(saved)) {
      try {
        thread.importExternalState(saved);
        restoringRef.current = false;
      } catch {
        // Incompatible snapshot: fall back to a clean thread rather than showing stale messages.
        void runtime.threads.switchToNewThread().finally(() => { restoringRef.current = false; });
      }
    } else {
      void runtime.threads.switchToNewThread().finally(() => { restoringRef.current = false; });
    }

    // Mirror every thread change to the ACTIVE conversation (keyed off `activeIdRef`, not a fixed
    // key). Fires per streamed token, so it only re-renders the rail on a structural change.
    const persist = () => {
      if (restoringRef.current) return;
      let snapshot: ConversationSnapshot;
      try {
        snapshot = thread.exportExternalState() as ConversationSnapshot;
      } catch {
        return;
      }
      const count = snapshot.messages?.length ?? 0;
      if (count === 0) return; // never persist an empty thread (a just-started new conversation)

      const wasNew = activeIdRef.current === null;
      if (wasNew) {
        activeIdRef.current = crypto.randomUUID();
        createdAtRef.current = Date.now();
      }
      const id = activeIdRef.current;
      if (id === null) return; // unreachable after the mint above; narrows the type without `!`

      if (!saveConversationSnapshot(userKey, projectKey, id, snapshot)) {
        // Quota: evict the oldest OTHER conversation, then retry the write once.
        const oldest = loadConversationIndex(userKey, projectKey).items
          .filter(i => i.id !== id)
          .sort((a, b) => a.updatedAt - b.updatedAt)[0];
        if (oldest) {
          const after = removeConversation(userKey, projectKey, oldest.id);
          setHistory(h => ({ items: after.items, activeId: h.activeId }));
          void pruneArtifacts(artifactScope, unionArtifactRefs(userKey, projectKey, after.items)).catch(() => {});
        }
        saveConversationSnapshot(userKey, projectKey, id, snapshot);
      }

      const meta: ConversationMeta = {
        id,
        title: deriveConversationTitle(snapshot, ''),
        createdAt: createdAtRef.current || Date.now(),
        updatedAt: Date.now(),
        messageCount: count,
      };
      const { index: nextIndex, evicted } = upsertConversation(userKey, projectKey, meta);
      for (const evictedId of evicted) removeConversationSnapshot(userKey, projectKey, evictedId);
      if (evicted.length) {
        void pruneArtifacts(artifactScope, unionArtifactRefs(userKey, projectKey, nextIndex.items)).catch(() => {});
      }
      // Re-render the rail only when the conversation set changed (new conversation / eviction) —
      // not on every token; title/updatedAt of the active row settle without live churn.
      if (wasNew || evicted.length) {
        setHistory({ items: nextIndex.items, activeId: id });
      }
    };
    return thread.subscribe(persist);
  }, [runtime, userKey, projectKey, artifactScope]);

  const startNewConversation = useCallback(() => {
    // The current conversation is already persisted under its id, so it stays in history. Just
    // detach the active pointer and switch to a fresh empty thread; the next message mints a new id.
    restoringRef.current = true;
    activeIdRef.current = null;
    createdAtRef.current = 0;
    setHistory(h => ({ items: h.items, activeId: null }));
    setActiveConversation(userKey, projectKey, null);
    void runtime.threads.switchToNewThread().finally(() => { restoringRef.current = false; });
  }, [runtime, userKey, projectKey]);

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
  }, [runtime, userKey, projectKey]);

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
  }, [userKey, projectKey, artifactScope, selectConversation, startNewConversation]);

  const status: TraceyChat['status'] = !projectId || !interactive
    ? 'no-project'
    : queryStatus === 'pending'
      ? 'loading'
      : queryStatus === 'error'
        ? 'error'
        : 'ready';

  return {
    runtime,
    status,
    conversations,
    activeConversationId,
    selectConversation,
    deleteConversation,
    startNewConversation,
    navigate,
    activate,
  };
}
