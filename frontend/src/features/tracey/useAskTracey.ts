import { useCallback, useEffect, useRef } from 'react';
import type { useChatRuntime } from '@assistant-ui/react-ai-sdk';

interface AskTraceyDeps {
  runtime: ReturnType<typeof useChatRuntime>;
  /** The chat's session status; sending is possible only once 'ready'. */
  status: 'no-project' | 'loading' | 'error' | 'ready';
  /** Latches the lazy session query on (backend agent provisioning). */
  activate: () => void;
  /** Archives the active conversation and resolves once a fresh empty thread is live. */
  startFreshThread: () => Promise<void>;
  navigate: (path: string) => void;
}

/**
 * The app-wide "Ask Tracey" entry point. Called from any page (via `AskTraceyButton`), it
 * navigates to the Tracey page, starts a fresh conversation, and sends the given prompt as the
 * first user message. The send is queued: the transport rejects until the session resolves
 * (`DelegatingTransport`), so the prompt waits for `status === 'ready'` and is dropped if the
 * session errors (the page then shows its contained error state instead). The queue lives in
 * refs — flushing appends to the runtime, which is not React state.
 */
export function useAskTracey({ runtime, status, activate, startFreshThread, navigate }: AskTraceyDeps): (prompt: string) => void {
  const pendingRef = useRef<string | null>(null);
  const statusRef = useRef(status);

  const flush = useCallback(() => {
    const prompt = pendingRef.current;
    if (prompt === null) return;
    pendingRef.current = null;
    // A plain-string append adds a user message and starts the run (CreateAppendMessage).
    runtime.thread.append(prompt);
  }, [runtime]);

  useEffect(() => {
    statusRef.current = status;
    if (status === 'error') {
      pendingRef.current = null;
      return;
    }
    if (status === 'ready') flush();
  }, [status, flush]);

  return useCallback(
    (prompt: string) => {
      activate();
      navigate('/tracey-ai');
      // Queue the prompt only once the fresh thread is live so it can't land in the old one.
      void startFreshThread().then(() => {
        if (statusRef.current === 'error') return;
        pendingRef.current = prompt;
        if (statusRef.current === 'ready') flush();
      });
    },
    [activate, navigate, startFreshThread, flush],
  );
}
