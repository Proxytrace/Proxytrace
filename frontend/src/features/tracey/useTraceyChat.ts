import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useChatRuntime } from '@assistant-ui/react-ai-sdk';
import type { ExportedMessageRepository } from '@assistant-ui/react';
import type {
  ChatTransport,
  UIMessage,
  UIMessageChunk,
} from 'ai';
import { traceyApi, type TraceySessionDto } from '../../api/tracey';
import { QUERY_KEYS } from '../../api/query-keys';
import useCurrentProject from '../../hooks/useCurrentProject';
import { useCurrentUser } from '../../auth/useCurrentUser';
import { useKiosk } from '../../contexts/KioskContext';
import { TRACEY_SYSTEM_PROMPT } from './tracey-prompt';
import { TraceyTransport } from './tracey-runtime';
import type { TraceyToolContext } from './tracey-tools';
import { clearThread, loadThread, saveThread } from './tracey-storage';

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
  /** Append a new user turn (used by interactive tool UIs). */
  sendUserMessage: (text: string) => void;
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
  // Tracey makes real LLM calls, so she's unavailable in read-only kiosk/demo mode. Since the
  // runtime now mounts app-wide (above the router), gate the session here so kiosk never
  // provisions one.
  const { enabled: kiosk } = useKiosk();
  // The runtime mounts app-wide, but the session (and its backend agent provisioning) is only
  // created once the user opens Tracey. Latched on, so it stays alive across navigation.
  const [activated, setActivated] = useState(false);
  const activate = useCallback(() => setActivated(true), []);
  const projectId = currentProject?.id;
  const userKey = currentUser?.email ?? 'anon';
  const projectKey = projectId ?? 'none';

  const [autoApprove, setAutoApprove] = useState(false);
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
    enabled: !!projectId && !kiosk && activated,
    // Refresh comfortably before the 1-hour key expiry.
    staleTime: 50 * 60 * 1000,
    refetchInterval: 50 * 60 * 1000,
    // This hook is mounted app-wide (in Shell, above the router), so a failed session must not
    // bubble to an ErrorBoundary and crash the shell on every page. The 'error' status is
    // surfaced as a contained empty state on the Tracey page instead (see TraceyAI).
    throwOnError: false,
  });

  const transport = useMemo(() => new DelegatingTransport(), []);
  const runtime = useChatRuntime({ transport });

  // Appends a new user turn — interactive tool UIs (choice prompts, forms) feed a selection
  // back to the model through this.
  const sendUserMessage = useCallback((text: string) => {
    runtime.thread.append(text);
  }, [runtime]);

  const toolContext = useMemo<TraceyToolContext>(
    () => ({ projectId, navigate, confirm, sendUserMessage }),
    [projectId, navigate, confirm, sendUserMessage],
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
    if (saved && saved.messages?.length) {
      try {
        thread.import(saved);
      } catch {
        // A snapshot from an incompatible runtime version is non-fatal: start fresh.
      }
    }
    const persist = () => {
      try {
        saveThread(userKey, projectKey, thread.export());
      } catch {
        // non-fatal
      }
    };
    return thread.subscribe(persist);
  }, [runtime, userKey, projectKey]);

  const clear = useCallback(() => {
    clearThread(userKey, projectKey);
    runtime.threads.switchToNewThread();
  }, [runtime, userKey, projectKey]);

  const status: TraceyChat['status'] = !projectId || kiosk
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
    sendUserMessage,
    navigate,
    activate,
  };
}
