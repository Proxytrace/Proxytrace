import { useQuery } from '@tanstack/react-query';
import { evaluatorsApi } from '../../../api/evaluators';
import { QUERY_KEYS } from '../../../api/query-keys';
import useCurrentProject from '../../../hooks/useCurrentProject';
import type { EvaluatorDetailDto } from '../../../api/models';

/** Evaluators for the current project, sorted by name, for the playground picker. */
export function useEvaluatorList() {
  const { currentProject } = useCurrentProject();
  const projectId = currentProject?.id ?? null;

  const query = useQuery({
    queryKey: QUERY_KEYS.evaluators(projectId ?? undefined),
    queryFn: () => evaluatorsApi.list(projectId ? { projectId } : undefined),
    enabled: projectId != null,
  });

  const evaluators = (query.data ?? []) as EvaluatorDetailDto[];
  const sorted = [...evaluators].sort((a, b) => a.name.localeCompare(b.name));

  return { evaluators: sorted, isLoading: query.isLoading, projectId };
}
