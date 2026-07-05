// Optimization-proposal queries for the current project. Shared (not feature-local)
// because both the Proposals view and the dashboard's fleet header consume them, and
// feature hooks must not be imported across feature boundaries (BEST_PRACTICES §2/§15).

import { useQuery } from '@tanstack/react-query';
import { proposalsApi } from '../api/proposals';
import { QUERY_KEYS } from '../api/query-keys';
import { ProposalStatus } from '../api/models';
import useCurrentProject from './useCurrentProject';
import { REFETCH_INTERVAL_LIVE, REFETCH_INTERVAL_SLOW } from '../lib/constants';

/**
 * Optimization proposals for the current project. Polls live while validation is in flight
 * (`poll`), since a validated theory spawns a proposal server-side; polls slowly otherwise —
 * a promoted proposal can flip to Adopted server-side at any time when the change is detected
 * in the agent's live traffic.
 */
export function useProposals(poll = false) {
  const { currentProjectId } = useCurrentProject();
  const projectId = currentProjectId ?? undefined;
  const query = useQuery({
    queryKey: QUERY_KEYS.proposals(undefined, projectId),
    queryFn: () => proposalsApi.getAll({ projectId }),
    refetchInterval: poll ? REFETCH_INTERVAL_LIVE : REFETCH_INTERVAL_SLOW,
    enabled: currentProjectId !== null,
  });
  return { proposals: query.data ?? [], isLoading: query.isLoading };
}

/** Count of Draft (pending-review) proposals — powers the dashboard fleet header's chip. */
export function useDraftProposalCount(): number {
  const { proposals } = useProposals();
  return proposals.filter(p => p.status === ProposalStatus.Draft).length;
}
