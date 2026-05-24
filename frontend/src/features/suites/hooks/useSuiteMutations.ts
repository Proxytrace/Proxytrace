import { useQueryClient, useMutation } from '@tanstack/react-query';
import { testSuitesApi } from '../../../api/test-suites';
import { testRunGroupsApi } from '../../../api/test-run-groups';
import { QUERY_KEYS } from '../../../api/query-keys';

interface StartRunArgs {
  suiteId: string;
  endpointIds: string[];
}

/** Mutation to kick off a new test run group. Invalidates the run-groups list. */
export function useStartRun(onSuccess: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ suiteId, endpointIds }: StartRunArgs) =>
      testRunGroupsApi.create(suiteId, endpointIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.testRunGroupsRoot });
      onSuccess();
    },
  });
}

/** Mutation to delete a test suite. Invalidates the suites list. */
export function useDeleteSuite(onSuccess: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => testSuitesApi.delete(id),
    onSuccess: () => {
      // QUERY_KEYS.testSuites prefix matches all testSuites queries
      qc.invalidateQueries({ queryKey: QUERY_KEYS.testSuites() });
      onSuccess();
    },
  });
}

interface CreateSuiteArgs {
  name: string;
  agentId: string;
  agentCallIds: string[];
  evaluatorIds: string[];
}

/** Mutation to create a new test suite. Invalidates the suites list. */
export function useCreateSuite(onSuccess: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: CreateSuiteArgs) => testSuitesApi.create(args),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.testSuites() });
      onSuccess();
    },
  });
}
