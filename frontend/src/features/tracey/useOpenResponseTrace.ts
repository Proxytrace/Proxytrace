import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { agentCallsApi } from '../../api/agent-calls';
import type { AgentCallFilter } from '../../api/models';
import { QUERY_KEYS } from '../../api/query-keys';
import { showToast } from '../../components/ui/Toast';
import { useTraceyActions } from './tracey-actions';

/**
 * Resolves a Tracey turn's correlation id (its captured calls' ConversationId) to the latest
 * matching trace and routes to the Traces detail view (which expands the turn's conversation
 * group). Resolved on demand at click time — not polled — so it's a single fetch by the time the
 * user clicks. Ingestion is asynchronous, so a just-finished turn may not be captured yet; that
 * surfaces as an info toast rather than a dead link.
 */
export function useOpenResponseTrace() {
  const queryClient = useQueryClient();
  const { navigate } = useTraceyActions();
  const [isOpening, setIsOpening] = useState(false);

  const openTrace = useCallback(
    async (conversationId: string) => {
      setIsOpening(true);
      try {
        const filter: AgentCallFilter = { conversationId, pageSize: 1, includeSystemAgents: true };
        const result = await queryClient.fetchQuery({
          queryKey: QUERY_KEYS.agentCalls(filter),
          queryFn: () => agentCallsApi.list(filter),
        });
        const trace = result.items[0];
        if (trace) {
          navigate(`/traces?focus=${trace.id}`);
        } else {
          showToast('Trace is still being captured — try again in a moment.', 'info');
        }
      } catch {
        showToast('Could not open the trace for this response.', 'error');
      } finally {
        setIsOpening(false);
      }
    },
    [queryClient, navigate],
  );

  return { openTrace, isOpening };
}
