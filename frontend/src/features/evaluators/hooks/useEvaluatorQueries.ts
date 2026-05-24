import { useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { evaluatorsApi } from '../../../api/evaluators';
import { testSuitesApi } from '../../../api/test-suites';
import { statisticsApi } from '../../../api/statistics';
import { QUERY_KEYS } from '../../../api/query-keys';
import { rangeFrom, bucketFor, type RangeKey } from '../../../lib/time-range';
import { passFractionSeries, tailAvgPassFraction } from '../evaluatorMeta';

/** All evaluators in the current project. */
export function useEvaluators(projectId: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.evaluators(projectId ?? undefined),
    queryFn: () => evaluatorsApi.list(projectId ? { projectId } : undefined),
    enabled: projectId !== null,
  });
}

/** Test suites in the current project (used to derive attachment). */
export function useProjectTestSuites(projectId: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.testSuites(undefined, projectId ?? undefined),
    queryFn: () => testSuitesApi.list(projectId ? { projectId } : undefined),
    enabled: projectId !== null,
  });
}

/** Built-in agentic (LLM judge) presets for the create form. */
export function useAgenticPresets() {
  return useQuery({
    queryKey: QUERY_KEYS.agenticEvaluatorPresets,
    queryFn: evaluatorsApi.getAgenticPresets,
  });
}

/** Per-evaluator overview (summary, trend, distribution, cost) for a time range. */
export function useEvaluatorOverview(evaluatorId: string, range: RangeKey) {
  const params = useMemo(
    () => ({ from: rangeFrom(range), to: new Date().toISOString(), bucket: bucketFor(range) }),
    [range],
  );
  return useQuery({
    queryKey: QUERY_KEYS.statisticsEvaluatorOverview(evaluatorId, range),
    queryFn: () => statisticsApi.evaluatorOverview(evaluatorId, params),
    retry: false,
    placeholderData: keepPreviousData,
  });
}

/** Recent evaluations table data for one evaluator. */
export function useRecentEvaluations(evaluatorId: string, count = 8) {
  return useQuery({
    queryKey: QUERY_KEYS.evaluatorRecentEvaluations(evaluatorId, count),
    queryFn: () => evaluatorsApi.recentEvaluations(evaluatorId, count),
    retry: false,
  });
}

export interface EvaluatorSparklines {
  sparklineById: Map<string, number[]>;
  avgScoreById: Map<string, number | null>;
}

/**
 * Pass-rate sparklines + coarse average per evaluator for the rail.
 * Fetches over a fixed 7d window; guarded on `projectId`.
 */
export function useEvaluatorSparklines(projectId: string | null): EvaluatorSparklines {
  const range: RangeKey = '7d';
  const params = useMemo(
    () =>
      projectId
        ? {
            projectId,
            from: rangeFrom(range),
            to: new Date().toISOString(),
            bucket: bucketFor(range),
          }
        : null,
    [projectId],
  );

  const { data: rows } = useQuery({
    queryKey: QUERY_KEYS.statisticsEvaluatorSparklines(projectId ?? '', range),
    queryFn: () => statisticsApi.evaluatorSparklines(params ?? { projectId: '', from: '', to: '', bucket: bucketFor(range) }),
    enabled: params !== null,
    retry: false,
  });

  return useMemo(() => {
    const sparklineById = new Map<string, number[]>();
    const avgScoreById = new Map<string, number | null>();
    for (const row of rows ?? []) {
      sparklineById.set(row.evaluatorId, passFractionSeries(row.points));
      avgScoreById.set(row.evaluatorId, tailAvgPassFraction(row.points));
    }
    return { sparklineById, avgScoreById };
  }, [rows]);
}
