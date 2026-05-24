import { useMutation, useQueryClient } from '@tanstack/react-query';
import { proposalsApi } from '../../../api/proposals';
import type { ProposalStatus } from '../../../api/models';

/** Mutates a proposal's status and invalidates all proposals queries on success. */
export function useUpdateProposalStatus(proposalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (next: ProposalStatus) => proposalsApi.updateStatus(proposalId, next),
    // Broad invalidation: bust every proposals query regardless of filter args.
    onSuccess: () => qc.invalidateQueries({ predicate: q => q.queryKey[0] === 'proposals' }),
  });
}
