import { useQuery, type QueryKey } from '@tanstack/react-query';
import { agentsApi } from '../../../api/agents';
import { agentCallsApi } from '../../../api/agent-calls';
import { proposalsApi } from '../../../api/proposals';
import { testRunGroupsApi } from '../../../api/test-run-groups';
import { QUERY_KEYS } from '../../../api/query-keys';
import type { RequestOptions } from '../../../api/client';

/**
 * By-id fetches for a notification's target, one hook per {@link NotificationTargetKind} so each
 * preview component owns its own query (no conditional hooks behind a switch).
 *
 * `TargetId` is a deliberate soft reference — the target can be deleted while the notification
 * survives — so a 404 is a normal outcome here: it stays silent (no error toast), doesn't retry,
 * and never throws to the error boundary. The preview renders a "no longer available" state.
 */
const TOLERANT_404: RequestOptions = { silentStatuses: [404] };

function useTargetQuery<T>(queryKey: QueryKey, queryFn: () => Promise<T>) {
  return useQuery({ queryKey, queryFn, throwOnError: false, retry: false });
}

export function useTestRunGroupTarget(id: string) {
  return useTargetQuery(QUERY_KEYS.testRunGroup(id), () => testRunGroupsApi.get(id, TOLERANT_404));
}

export function useAgentTarget(id: string) {
  return useTargetQuery(QUERY_KEYS.agent(id), () => agentsApi.get(id, TOLERANT_404));
}

export function useProposalTarget(id: string) {
  return useTargetQuery(QUERY_KEYS.proposal(id), () => proposalsApi.get(id, TOLERANT_404));
}

export function useAgentCallTarget(id: string) {
  return useTargetQuery(QUERY_KEYS.agentCall(id), () => agentCallsApi.get(id, TOLERANT_404));
}
