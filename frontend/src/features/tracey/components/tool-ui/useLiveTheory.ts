import { useQuery, useQueryClient } from '@tanstack/react-query';
import { theoriesApi } from '../../../../api/theories';
import { QUERY_KEYS } from '../../../../api/query-keys';
import { useTheoryStream } from '../../../../api/event-stream';
import type { TheoryDto } from '../../../../api/models';

/**
 * Keeps a just-submitted theory's status live inside the chat card. Seeds from the submit
 * result, re-syncs once from the API on mount (so a page reload that missed the SSE events still
 * shows the real state), and patches the cache in place as `theory-changed` events arrive —
 * never refetching the page on an event (BEST_PRACTICES §3.2).
 */
export function useLiveTheory(initial: TheoryDto): TheoryDto {
  const queryClient = useQueryClient();
  const key = QUERY_KEYS.theory(initial.id);

  const query = useQuery({
    queryKey: key,
    queryFn: () => theoriesApi.get(initial.id),
    initialData: initial,
  });

  useTheoryStream(initial.agentId, (event) => {
    if (event.id !== initial.id) return;
    queryClient.setQueryData<TheoryDto>(key, (prev) =>
      prev
        ? { ...prev, status: event.status, resultingProposalId: event.resultingProposalId, updatedAt: event.updatedAt }
        : prev,
    );
  });

  return query.data ?? initial;
}
