import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLingui } from '@lingui/react/macro';
import { type EvaluationResultDto, type MessageDto } from '../../../api/models';
import { evaluatorTestBenchApi } from '../../../api/evaluator-testbench';
import { QUERY_KEYS } from '../../../api/query-keys';
import { runLabel } from '../testBenchMeta';

/** One verdict in the history list (newest first): the logged baseline or a live re-score. */
export interface SessionRun {
  id: string;
  result: EvaluationResultDto;
  edited: boolean;
  /** Wall-clock time of a live re-score; null for the logged baseline. */
  at: number | null;
  kind: 'logged' | 'rescore';
}

export type PlaygroundSession = ReturnType<typeof usePlaygroundSession>;

/**
 * Owns the playground bench workflow for one (evaluator, test case): loads the
 * default case when none is picked, lets the candidate response be edited, runs
 * the evaluator live, and keeps a session run history so the verdict column can
 * show how an edit moved the score. Editable state + history reset when the
 * target changes (derive-on-change, no effect — BEST_PRACTICES §4.1).
 */
export function usePlaygroundSession(evaluatorId: string, selectedCaseId: string | null) {
  const { i18n } = useLingui();
  const [actualOverride, setActualOverride] = useState<string | null>(null);
  const [runs, setRuns] = useState<SessionRun[]>([]);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [prevKey, setPrevKey] = useState('');
  const [seededSourceId, setSeededSourceId] = useState<string | null>(null);

  const defaultQuery = useQuery({
    queryKey: QUERY_KEYS.evaluatorTestBenchDefault(evaluatorId),
    queryFn: () => evaluatorTestBenchApi.default(evaluatorId),
    enabled: evaluatorId.length > 0,
    staleTime: 60_000,
  });

  const effectiveCaseId = selectedCaseId ?? defaultQuery.data?.testCaseId ?? null;

  // Reset the editable candidate when the (evaluator, case) target changes.
  const key = `${evaluatorId}::${effectiveCaseId ?? ''}`;
  if (key !== prevKey) {
    setPrevKey(key);
    setActualOverride(null);
  }

  const payloadQuery = useQuery({
    queryKey: QUERY_KEYS.evaluatorTestBench(evaluatorId, effectiveCaseId ?? ''),
    queryFn: () => evaluatorTestBenchApi.load(evaluatorId, effectiveCaseId ?? ''),
    enabled: evaluatorId.length > 0 && effectiveCaseId != null,
    retry: false,
    staleTime: 60_000,
  });

  const payload = payloadQuery.data;

  // Seed the run history with the logged verdict whenever a new source result loads,
  // so selecting a past evaluation already shows its baseline (derive-on-change, no effect).
  const sourceId = payload?.sourceTestResultId ?? null;
  if (sourceId !== seededSourceId) {
    setSeededSourceId(sourceId);
    if (payload?.loggedEvaluation) {
      const baseline: SessionRun = {
        id: `logged-${sourceId}`,
        result: payload.loggedEvaluation,
        edited: false,
        at: null,
        kind: 'logged',
      };
      setRuns([baseline]);
      setCurrentRunId(baseline.id);
    } else {
      setRuns([]);
      setCurrentRunId(null);
    }
  }
  const originalActual = payload?.actualResponse ?? '';
  const currentActual = actualOverride ?? originalActual;
  const isModified = actualOverride != null && actualOverride.trim() !== originalActual.trim();

  const runMutation = useMutation({
    mutationFn: () =>
      evaluatorTestBenchApi.run(evaluatorId, {
        testCaseId: effectiveCaseId ?? '',
        actualResponseOverride: isModified ? currentActual : null,
      }),
    onSuccess: (result) => {
      const run: SessionRun = { id: `run-${Date.now()}`, result, edited: isModified, at: Date.now(), kind: 'rescore' };
      setRuns(prev => [run, ...prev]);
      setCurrentRunId(run.id);
    },
  });

  const conversationMessages: MessageDto[] = (payload?.conversation ?? []).map(m => ({
    role: m.role,
    content: m.content,
    toolRequests: [],
    toolCallId: null,
  }));

  const currentRun = runs.find(r => r.id === currentRunId) ?? runs[0] ?? null;
  const currentIdx = currentRun ? runs.indexOf(currentRun) : -1;
  const prevRun = currentIdx >= 0 ? runs[currentIdx + 1] ?? null : null;

  return {
    effectiveCaseId,
    payload,
    payloadLoading: payloadQuery.isLoading,
    payloadError: payloadQuery.isError,
    payloadErrorMessage: String((payloadQuery.error as Error)?.message ?? 'Failed to load'),
    conversationMessages,
    currentActual,
    originalActual,
    isModified,
    setActual: setActualOverride,
    resetActual: () => setActualOverride(null),
    run: runMutation.mutate,
    runPending: runMutation.isPending,
    runError: runMutation.isError,
    runLabel: i18n._(runLabel(runMutation.isPending, runs.length > 0)),
    runDisabled: effectiveCaseId == null || payloadQuery.isLoading || runMutation.isPending,
    runs,
    currentRun,
    prevRun,
    selectRun: setCurrentRunId,
  };
}
