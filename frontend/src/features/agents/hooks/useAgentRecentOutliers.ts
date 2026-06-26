import { useQuery, useQueryClient } from '@tanstack/react-query';
import { agentCallsApi } from '../../../api/agent-calls';
import { QUERY_KEYS } from '../../../api/query-keys';
import { useTraceStream } from '../../../api/event-stream';
import useCurrentProject from '../../../hooks/useCurrentProject';

const RECENT_LIMIT = 6;

/** The most recent calls for one agent flagged as outliers, kept fresh via the trace SSE stream. */
export function useAgentRecentOutliers(agentId: string) {
  const qc = useQueryClient();
  const { currentProjectId } = useCurrentProject();

  const filter = {
    agentId,
    projectId: currentProjectId ?? undefined,
    includeSystemAgents: true,
    outlierOnly: true,
    page: 1,
    pageSize: RECENT_LIMIT,
  };

  const query = useQuery({
    queryKey: QUERY_KEYS.agentCalls(filter),
    queryFn: () => agentCallsApi.list(filter),
    enabled: currentProjectId !== null,
  });

  useTraceStream(evt => {
    if (evt.agentId !== agentId) return;
    qc.invalidateQueries({ queryKey: QUERY_KEYS.agentCalls(filter) });
  });

  return { outliers: query.data?.items ?? [], isLoading: query.isLoading };
}
