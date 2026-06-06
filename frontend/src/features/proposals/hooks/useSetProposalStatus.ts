import { useMutation, useQueryClient } from '@tanstack/react-query';
import { proposalsApi } from '../../../api/proposals';
import type { ProposalStatus } from '../../../api/models';

export interface SetProposalStatusVars {
  id: string;
  status: ProposalStatus;
}

/**
 * Sets a proposal's status (Promote → Accepted, Dismiss → Rejected) by id. Keyed at mutate-time
 * so a single instance serves every board card and the detail drawer. Invalidates both proposals
 * and theories (a promotion/dismissal flips the linked theory's outcome).
 */
export function useSetProposalStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: SetProposalStatusVars) => proposalsApi.updateStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ predicate: q => q.queryKey[0] === 'proposals' });
      qc.invalidateQueries({ predicate: q => q.queryKey[0] === 'theories' });
    },
  });
}
