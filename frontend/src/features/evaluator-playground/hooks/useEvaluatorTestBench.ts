import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { type EvaluationResultDto, type MessageDto } from '../../../api/models';
import { evaluatorTestBenchApi } from '../../../api/evaluator-testbench';
import { QUERY_KEYS } from '../../../api/query-keys';
import type { SearchHit } from '../../../api/search';

/**
 * Owns the evaluator test-bench workflow: load a default/picked test case, edit
 * the actual response, and run the evaluator. All queries + their derived state
 * live here so the component is presentational. Resets editable state whenever
 * `evaluatorId` changes (derive-on-change, no effect — BEST_PRACTICES §4.1).
 */
export function useEvaluatorTestBench(evaluatorId: string) {
  const [pickedHit, setPickedHit] = useState<SearchHit | null>(null);
  const [actualOverride, setActualOverride] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<EvaluationResultDto | null>(null);
  const [prevEvaluatorId, setPrevEvaluatorId] = useState(evaluatorId);

  const defaultQuery = useQuery({
    queryKey: QUERY_KEYS.evaluatorTestBenchDefault(evaluatorId),
    queryFn: () => evaluatorTestBenchApi.default(evaluatorId),
    staleTime: 60_000,
  });

  if (evaluatorId !== prevEvaluatorId) {
    setPrevEvaluatorId(evaluatorId);
    setPickedHit(null);
    setActualOverride(null);
    setLastResult(null);
  }

  const defaultData = defaultQuery.data;
  const autoHit: SearchHit | null =
    pickedHit != null || defaultData?.testCaseId == null
      ? null
      : {
          kind: 'testCase' as const,
          entityId: defaultData.testCaseId,
          title: defaultData.label ?? 'Test case',
          snippet: '',
          score: 0,
          metadata: {} as Record<string, string>,
        };

  const effectivePickedHit = pickedHit ?? autoHit;
  const testCaseId = effectivePickedHit?.entityId ?? null;

  const payloadQuery = useQuery({
    queryKey: QUERY_KEYS.evaluatorTestBench(evaluatorId, testCaseId ?? ''),
    queryFn: () => evaluatorTestBenchApi.load(evaluatorId, testCaseId ?? ''),
    enabled: testCaseId != null,
    retry: false,
    staleTime: 60_000,
  });

  const payload = payloadQuery.data;
  const originalActual = payload?.actualResponse ?? '';
  const currentActual = actualOverride ?? originalActual;
  const isModified = actualOverride != null && actualOverride !== originalActual;

  const runMutation = useMutation({
    mutationFn: () => evaluatorTestBenchApi.run(evaluatorId, {
      testCaseId: testCaseId ?? '',
      actualResponseOverride: isModified ? currentActual : null,
    }),
    onSuccess: (r) => setLastResult(r),
  });

  function onPick(hit: SearchHit) {
    setPickedHit(hit);
    setActualOverride(null);
    setLastResult(null);
  }

  const onResetActual = () => setActualOverride(null);

  const conversationMessages: MessageDto[] = (payload?.conversation ?? []).map(m => ({
    role: m.role,
    content: m.content,
    toolRequests: [],
    toolCallId: null,
  }));

  const runDisabled = testCaseId == null || payloadQuery.isLoading || runMutation.isPending;
  const runLabel = runMutation.isPending
    ? 'Running…'
    : lastResult != null
      ? 'Re-run'
      : 'Run evaluator';

  return {
    selectedLabel: effectivePickedHit?.title ?? null,
    testCaseId,
    payload,
    payloadLoading: payloadQuery.isLoading,
    payloadError: payloadQuery.isError,
    payloadErrorMessage: String((payloadQuery.error as Error)?.message ?? 'Failed to load'),
    conversationMessages,
    currentActual,
    isModified,
    setActualOverride,
    onPick,
    onResetActual,
    run: runMutation.mutate,
    runDisabled,
    runLabel,
    runPending: runMutation.isPending,
    runError: runMutation.isError,
    lastResult,
  };
}
