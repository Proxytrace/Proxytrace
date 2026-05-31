import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useChatRuntime } from '@assistant-ui/react-ai-sdk';
import type {
  ChatTransport,
  UIMessage,
  UIMessageChunk,
} from 'ai';
import { traceyApi, type TraceySessionDto } from '../../api/tracey';
import { QUERY_KEYS } from '../../api/query-keys';
import useCurrentProject from '../../hooks/useCurrentProject';
import { useCurrentUser } from '../../auth/useCurrentUser';
import { TRACEY_SYSTEM_PROMPT } from './tracey-prompt';
import { TraceyTransport } from './tracey-runtime';
import type { TraceyToolContext } from './tracey-tools';
import { clearThread, saveThread } from './tracey-storage';
import { withId, type TraceyArtifact, type TraceyArtifactInput } from './tracey-artifacts';

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
  artifacts: TraceyArtifact[];
  activeArtifactId: string | null;
  showArtifact: (artifact: TraceyArtifactInput) => void;
  selectArtifact: (id: string) => void;
  clearArtifacts: () => void;
}

export function useTraceyChat(): TraceyChat {
  const navigate = useNavigate();
  const { currentProject } = useCurrentProject();
  const currentUser = useCurrentUser();
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

  const [artifacts, setArtifacts] = useState<TraceyArtifact[]>([]);
  const [activeArtifactId, setActiveArtifactId] = useState<string | null>(null);

  const showArtifact = useCallback((input: TraceyArtifactInput) => {
    const artifact = withId(input);
    setArtifacts(prev => [...prev, artifact]);
    setActiveArtifactId(artifact.id);
  }, []);

  const selectArtifact = useCallback((id: string) => setActiveArtifactId(id), []);

  const clearArtifacts = useCallback(() => {
    setArtifacts([]);
    setActiveArtifactId(null);
  }, []);

  const toolContext = useMemo<TraceyToolContext>(
    () => ({ projectId, navigate, confirm, showArtifact }),
    [projectId, navigate, confirm, showArtifact],
  );

  const { data: session, status: queryStatus } = useQuery<TraceySessionDto>({
    queryKey: QUERY_KEYS.traceySession(projectId),
    queryFn: () => traceyApi.getSession(projectId),
    enabled: !!projectId,
    // Refresh comfortably before the 1-hour key expiry.
    staleTime: 50 * 60 * 1000,
    refetchInterval: 50 * 60 * 1000,
  });

  const transport = useMemo(() => new DelegatingTransport(), []);
  const runtime = useChatRuntime({ transport });

  // Swap in the real same-origin transport whenever the session (or tool context) changes.
  useEffect(() => {
    transport.setInner(
      session && projectId
        ? new TraceyTransport(projectId, session.model, toolContext, TRACEY_SYSTEM_PROMPT)
        : null,
    );
  }, [transport, session, projectId, toolContext]);

  // Best-effort thread persistence so the conversation survives navigation/reload.
  useEffect(() => {
    const thread = runtime.thread;
    const persist = () => {
      try {
        saveThread(userKey, projectKey, thread.getState().messages as unknown[]);
      } catch {
        // non-fatal
      }
    };
    return thread.subscribe(persist);
  }, [runtime, userKey, projectKey]);

  const clear = useCallback(() => {
    clearThread(userKey, projectKey);
    runtime.threads.switchToNewThread();
    setArtifacts([]);
    setActiveArtifactId(null);
  }, [runtime, userKey, projectKey]);

  const status: TraceyChat['status'] = !projectId
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
    artifacts,
    activeArtifactId,
    showArtifact,
    selectArtifact,
    clearArtifacts,
  };
}
