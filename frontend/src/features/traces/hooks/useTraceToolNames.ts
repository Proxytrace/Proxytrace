import { useQuery } from '@tanstack/react-query';
import { agentCallsApi } from '../../../api/agent-calls';
import { QUERY_KEYS } from '../../../api/query-keys';
import useCurrentProject from '../../../hooks/useCurrentProject';

/**
 * Distinct tool names for the tool filter's picker. Scoped to `agentId` when an agent filter is
 * active, so the tool options only list tools that agent actually used (else the whole project).
 */
export function useTraceToolNames(agentId?: string): string[] {
  const { currentProjectId } = useCurrentProject();
  const query = useQuery({
    queryKey: QUERY_KEYS.agentCallToolNames(currentProjectId ?? undefined, agentId),
    queryFn: () => agentCallsApi.toolNames(currentProjectId ?? '', agentId),
    enabled: currentProjectId !== null,
  });
  return query.data ?? [];
}
