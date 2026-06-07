import { useMutation, useQueryClient } from '@tanstack/react-query';
import { theoriesApi } from '../../../api/theories';

/**
 * Resets a terminal theory (Validated/Invalidated) back to Proposed and re-queues it for
 * validation, deleting any spawned proposal server-side. Invalidates both theories and proposals
 * so the board reflects the cleared outcome.
 */
export function useResetTheory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => theoriesApi.reset(id),
    onSuccess: () => {
      qc.invalidateQueries({ predicate: q => q.queryKey[0] === 'theories' });
      qc.invalidateQueries({ predicate: q => q.queryKey[0] === 'proposals' });
    },
  });
}
