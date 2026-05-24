import { useQuery } from '@tanstack/react-query';
import { evaluatorsApi } from '../../../api/evaluators';
import { agentCallsApi } from '../../../api/agent-calls';
import { QUERY_KEYS } from '../../../api/query-keys';
import type { EvaluatorDetailDto } from '../../../api/models';

/** Evaluators list for the edit-suite dialog. */
export function useEditSuiteEvaluators(projectId?: string) {
  const query = useQuery({
    queryKey: QUERY_KEYS.evaluators(projectId),
    queryFn: () => evaluatorsApi.list({ projectId }),
  });
  return { evaluators: (query.data ?? []) as EvaluatorDetailDto[] };
}

/** Agent calls available to add as new test cases in the edit-suite dialog. */
export function useEditSuiteTraces(agentId: string) {
  const query = useQuery({
    queryKey: QUERY_KEYS.agentCallsForSuiteEdit(agentId),
    queryFn: () => agentCallsApi.list({ agentId, pageSize: 50 }),
  });
  return { traces: query.data?.items ?? [] };
}
