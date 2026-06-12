import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useChatRuntime } from '@assistant-ui/react-ai-sdk';
import type { ExportedMessageRepository } from '@assistant-ui/react';
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
import { clearThread, loadAutoApprove, loadThread, saveAutoApprove, saveThread } from './tracey-storage';
import { clearArtifacts, collectArtifactRefs, pruneArtifacts } from './tracey-artifact-store';

export interface PendingConfirmation {
  summary: string;
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
  autoApprove: boolean;
  setAutoApprove: (value: boolean) => void;
  pendingConfirmation: PendingConfirmation | null;
  resolveConfirmation: (approved: boolean) => void;
  clear: () => void;
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
  // Scope under which Tracey's large tool payloads are stored, so a thread reset wipes exactly
  // this user+project's artifacts (see tracey-artifact-store).
  const artifactScope = `${userKey}:${projectKey}`;

  // Persisted in localStorage so the preference survives reloads; defaults to on.
  const [autoApprove, setAutoApproveState] = useState(loadAutoApprove);
  const setAutoApprove = useCallback((value: boolean) => {
    saveAutoApprove(value);
    setAutoApproveState(value);
  }, []);
  const autoApproveRef = useRef(autoApprove);
  useEffect(() => {
    autoApproveRef.current = autoApprove;
  }, [autoApprove]);

  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const confirmResolverRef = useRef<((approved: boolean) => void) | null>(null);

  const confirm = useCallback((summary: string): Promise<boolean> => {
    if (autoApproveRef.current) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      confirmResolverRef.current = resolve;
      setPendingConfirmation({ summary });
    });
  }, []);

  const resolveConfirmation = useCallback((approved: boolean) => {
    confirmResolverRef.current?.(approved);
    confirmResolverRef.current = null;
    setPendingConfirmation(null);
  }, []);

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

  // Thread persistence so the conversation survives navigation/reload. We restore the saved
  // snapshot once on mount (before subscribing) and then mirror every change back to storage.
  useEffect(() => {
    const thread = runtime.thread;
    const saved = loadThread<ExportedMessageRepository>(userKey, projectKey);
    let liveRefs = new Set<string>();
    if (saved && saved.messages?.length) {
      try {
        thread.import(saved);
        liveRefs = collectArtifactRefs(saved);
      } catch {
        // A snapshot from an incompatible runtime version is non-fatal: start fresh.
      }
    }
    // Dispose of artifacts the restored thread no longer references — orphans from a replaced
    // thread, a failed restore, or a write whose snapshot never persisted. Run only at mount (the
    // thread is stable here); pruning mid-stream could race a just-written blob whose reference is
    // not yet in the persisted snapshot and delete a live one.
    void pruneArtifacts(artifactScope, liveRefs).catch(() => {});
    const persist = () => {
      try {
        saveThread(userKey, projectKey, thread.export());
      } catch {
        // non-fatal
      }
    };
    return thread.subscribe(persist);
  }, [runtime, userKey, projectKey, artifactScope]);

  const clear = useCallback(() => {
    clearThread(userKey, projectKey);
    // Best-effort: a failed blob wipe must not block starting a new thread.
    void clearArtifacts(artifactScope).catch(() => {});
    runtime.threads.switchToNewThread();
  }, [runtime, userKey, projectKey, artifactScope]);

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
    autoApprove,
    setAutoApprove,
    pendingConfirmation,
    resolveConfirmation,
    clear,
    navigate,
    activate,
  };
}
