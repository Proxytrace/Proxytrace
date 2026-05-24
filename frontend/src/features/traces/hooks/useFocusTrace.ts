import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { agentCallsApi } from '../../../api/agent-calls';
import type { AgentCallDto } from '../../../api/models';

interface FocusTraceActions {
  onTrace: (trace: AgentCallDto) => void;
  onExpandConversation: (conversationId: string) => void;
}

/**
 * Reads ?focus=<id> from the URL, fetches that trace, then calls back so the
 * page can select it and expose the matching conversation group. Clears the
 * param after handling (replaces history entry). This is a genuine external
 * side-effect (URL param + API call driving UI) per BEST_PRACTICES §4.1.
 */
export function useFocusTrace({ onTrace, onExpandConversation }: FocusTraceActions) {
  const [searchParams, setSearchParams] = useSearchParams();
  const focusId = searchParams.get('focus');

  useEffect(() => {
    if (!focusId) return;
    let cancelled = false;
    agentCallsApi.get(focusId).then(trace => {
      if (cancelled) return;
      onTrace(trace);
      if (trace.conversationId) {
        onExpandConversation(trace.conversationId);
      }
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.delete('focus');
        return next;
      }, { replace: true });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [focusId, setSearchParams, onTrace, onExpandConversation]);
}
