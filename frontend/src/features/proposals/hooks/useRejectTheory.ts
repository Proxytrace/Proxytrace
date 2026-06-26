import { useMutation, useQueryClient } from '@tanstack/react-query';
import { theoriesApi } from '../../../api/theories';

/**
 * Dismisses an active theory at the user's request: a Proposed theory is rejected without running
 * A/B validation; a Validating theory has its in-flight A/B run cancelled. Either way it lands in
 * Invalidated. Invalidates theories and proposals so the board reflects the cleared state.
 */
export function useRejectTheory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => theoriesApi.reject(id),
    onSuccess: () => {
      qc.invalidateQueries({ predicate: q => q.queryKey[0] === 'theories' });
      qc.invalidateQueries({ predicate: q => q.queryKey[0] === 'proposals' });
    },
  });
}
