import { useQuery } from '@tanstack/react-query';
import { evaluatorsApi } from '../../../api/evaluators';
import { QUERY_KEYS } from '../../../api/query-keys';
import useCurrentProject from '../../../hooks/useCurrentProject';
import type { EvaluatorListItemDto } from '../../../api/models';

/**
 * Lightweight evaluator list for the playground rail — id/kind/name only, so the
 * picker never pulls every evaluator's full system message / JSON schema. Full
 * detail is loaded per-evaluator only where a view actually needs it.
 */
export function useEvaluatorList() {
  const { currentProject } = useCurrentProject();
  const projectId = currentProject?.id ?? null;

  const query = useQuery({
    queryKey: QUERY_KEYS.evaluatorSummaries(projectId ?? undefined),
    queryFn: () => evaluatorsApi.summaries(projectId ? { projectId } : undefined),
    enabled: projectId != null,
  });

  const evaluators = (query.data ?? []) as EvaluatorListItemDto[];
  const sorted = [...evaluators].sort((a, b) => a.name.localeCompare(b.name));

  return { evaluators: sorted, isLoading: query.isLoading, projectId };
}
