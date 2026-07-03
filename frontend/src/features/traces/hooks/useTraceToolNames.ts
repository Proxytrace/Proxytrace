import { useQuery } from '@tanstack/react-query';
import { agentCallsApi } from '../../../api/agent-calls';
import { QUERY_KEYS } from '../../../api/query-keys';
import useCurrentProject from '../../../hooks/useCurrentProject';

/** Distinct tool names recorded for the current project — options for the tool filter's picker. */
export function useTraceToolNames(): string[] {
  const { currentProjectId } = useCurrentProject();
  const query = useQuery({
    queryKey: QUERY_KEYS.agentCallToolNames(currentProjectId ?? undefined),
    queryFn: () => agentCallsApi.toolNames(currentProjectId ?? ''),
    enabled: currentProjectId !== null,
  });
  return query.data ?? [];
}
