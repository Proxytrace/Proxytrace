import { useQueryClient, useMutation } from '@tanstack/react-query';
import { testSuitesApi } from '../../../api/test-suites';
import { testCasesApi } from '../../../api/test-cases';
import { testRunGroupsApi } from '../../../api/test-run-groups';
import { QUERY_KEYS } from '../../../api/query-keys';
import type { TestSuiteMessageDto } from '../../../api/models';

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
      // Invalidate the whole test-suites namespace. testSuites(undefined, undefined) yields
      // ['test-suites', undefined, null], which does NOT prefix-match a list keyed by an actual
      // projectId (['test-suites', undefined, <projectId>]); the bare root does.
      qc.invalidateQueries({ queryKey: QUERY_KEYS.testSuitesRoot });
      onSuccess();
    },
  });
}

/** Updates a test case's expected output; refreshes the suites namespace, then runs `onDone`. */
export function useUpdateTestCaseExpected(testCaseId: string, onDone: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (expected: TestSuiteMessageDto) => testCasesApi.update(testCaseId, expected),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.testSuitesRoot });
      onDone();
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
      qc.invalidateQueries({ queryKey: QUERY_KEYS.testSuitesRoot });
      onSuccess();
    },
  });
}
