import { useQuery } from '@tanstack/react-query';
import { testSuitesApi } from '../../../api/test-suites';
import { agentsApi } from '../../../api/agents';
import { evaluatorsApi } from '../../../api/evaluators';
import { QUERY_KEYS } from '../../../api/query-keys';
import useCurrentProject from '../../../hooks/useCurrentProject';
import { LIST_PAGE_SIZE } from '../../../lib/constants';
import type { EvaluatorDetailDto } from '../../../api/models';

/** Suites list for the current project. */
export function useSuites() {
  const { currentProjectId } = useCurrentProject();
  const projectId = currentProjectId ?? undefined;

  const query = useQuery({
    queryKey: QUERY_KEYS.testSuites(undefined, projectId),
    queryFn: () => testSuitesApi.list({ projectId, pageSize: LIST_PAGE_SIZE }),
  });

  return { suites: query.data?.items ?? [], isLoading: query.isLoading, projectId };
}

/** All agents for the current project (used for filter tabs). */
export function useSuiteAgents() {
  const { currentProjectId } = useCurrentProject();
  const projectId = currentProjectId ?? undefined;

  const query = useQuery({
    queryKey: QUERY_KEYS.agents(projectId),
    queryFn: () => agentsApi.list({ projectId, pageSize: LIST_PAGE_SIZE }),
  });

  return { agents: query.data?.items ?? [] };
}

/** All evaluators for the current project (used in create wizard). */
export function useSuiteEvaluators() {
  const { currentProjectId } = useCurrentProject();
  const projectId = currentProjectId ?? undefined;

  const query = useQuery({
    queryKey: QUERY_KEYS.evaluators(projectId),
    queryFn: () => evaluatorsApi.list({ projectId }),
  });

  return { evaluators: (query.data ?? []) as EvaluatorDetailDto[] };
}
