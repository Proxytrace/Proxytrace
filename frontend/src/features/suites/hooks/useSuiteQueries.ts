import { useQuery } from '@tanstack/react-query';
import { testSuitesApi } from '../../../api/test-suites';
import { agentsApi } from '../../../api/agents';
import { agentCallsApi } from '../../../api/agent-calls';
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

/** The full (fat) suite by id — complete test cases for the edit dialog. The list only carries light
 * {@link TestSuiteListItemDto} rows, so the edit dialog fetches the full suite on open. */
export function useSuiteDetail(suiteId: string) {
  const query = useQuery({
    queryKey: QUERY_KEYS.testSuite(suiteId),
    queryFn: () => testSuitesApi.get(suiteId),
    enabled: !!suiteId,
  });

  return { suite: query.data, isLoading: query.isLoading };
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

export const WIZARD_TRACE_PAGE_SIZE = 200;

/** Full candidate traces for the create-suite wizard's trace-curation step. */
export function useSuiteCreateTraces(agentId: string, from: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.agentCallsForSuiteCreate(agentId, from),
    queryFn: () => agentCallsApi.listFull({ agentId, pageSize: WIZARD_TRACE_PAGE_SIZE, from }),
    enabled: !!agentId,
  });
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
