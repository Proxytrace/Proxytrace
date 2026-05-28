import { useQuery } from '@tanstack/react-query';
import { agentCallsApi } from '../../../api/agent-calls';
import { QUERY_KEYS } from '../../../api/query-keys';

/** Agent calls available to add as new test cases when editing a suite. */
export function useSuiteAvailableTraces(agentId: string, enabled: boolean) {
  return useQuery({
    queryKey: QUERY_KEYS.agentCallsForSuiteEdit(agentId),
    queryFn: () => agentCallsApi.list({ agentId, pageSize: 50 }),
    enabled,
  });
}
