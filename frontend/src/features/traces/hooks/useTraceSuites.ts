import { useQuery } from '@tanstack/react-query';
import { testSuitesApi } from '../../../api/test-suites';
import { QUERY_KEYS } from '../../../api/query-keys';

export function useTraceSuites(agentId: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.testSuites(agentId ?? undefined),
    queryFn: () => testSuitesApi.list({ agentId: agentId ?? undefined, pageSize: 200 }),
    enabled: !!agentId,
  });
}
