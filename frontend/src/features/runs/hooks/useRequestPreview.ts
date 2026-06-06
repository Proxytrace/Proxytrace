import { useQuery } from '@tanstack/react-query';
import { testRunsApi } from '../../../api/test-runs';
import { QUERY_KEYS } from '../../../api/query-keys';

/**
 * Fetches the exact request (model + messages + tools) a run sends to the model for one case.
 * Rebuilt on demand from the current agent version, so it reflects what a re-run would send —
 * `enabled` gates it to when the viewer is actually open.
 */
export function useRequestPreview(runId: string, caseId: string, enabled: boolean) {
  return useQuery({
    queryKey: QUERY_KEYS.fixtureRequest(runId, caseId),
    queryFn: () => testRunsApi.getRequest(runId, caseId),
    enabled,
    staleTime: 60_000,
  });
}
