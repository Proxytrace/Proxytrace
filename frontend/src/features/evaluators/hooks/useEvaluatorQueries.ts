import { useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { evaluatorsApi } from '../../../api/evaluators';
import { QUERY_KEYS } from '../../../api/query-keys';
import { rangeFrom, bucketFor, type RangeKey } from '../../../lib/time-range';
import { passFractionSeries, tailAvgPassFraction } from '../evaluatorMeta';
import type { EvaluatorSuiteRefDto } from '../../../api/evaluators';
import type { EvaluationScore, EvaluatorDetailDto } from '../../../api/models';

export interface EvaluatorSparklines {
  sparklineById: Map<string, number[]>;
  avgScoreById: Map<string, number | null>;
}

export interface EvaluatorsOverview {
  evaluators: EvaluatorDetailDto[];
  suites: EvaluatorSuiteRefDto[];
  sparklines: EvaluatorSparklines;
  isLoading: boolean;
}

/**
 * One request serves the whole Evaluators list page: the evaluators, the suite attachment
 * refs, and the pass-rate sparklines (fetched over a fixed 7d window).
 */
export function useEvaluatorsOverview(projectId: string | null): EvaluatorsOverview {
  const range: RangeKey = '7d';
  const params = useMemo(
    () =>
      projectId
        ? { projectId, from: rangeFrom(range), to: new Date().toISOString(), bucket: bucketFor(range) }
        : null,
    [projectId],
  );

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.evaluatorsOverview(projectId ?? '', range),
    queryFn: () => evaluatorsApi.overview(params ?? { projectId: '' }),
    enabled: projectId !== null,
  });

  const sparklines = useMemo<EvaluatorSparklines>(() => {
    const sparklineById = new Map<string, number[]>();
    const avgScoreById = new Map<string, number | null>();
    for (const row of data?.sparklines ?? []) {
      sparklineById.set(row.evaluatorId, passFractionSeries(row.points));
      avgScoreById.set(row.evaluatorId, tailAvgPassFraction(row.points));
    }
    return { sparklineById, avgScoreById };
  }, [data]);

  return {
    evaluators: data?.evaluators ?? [],
    suites: data?.suites ?? [],
    sparklines,
    isLoading,
  };
}

/** Built-in agentic (LLM judge) presets for the create form. */
export function useAgenticPresets() {
  return useQuery({
    queryKey: QUERY_KEYS.agenticEvaluatorPresets,
    queryFn: evaluatorsApi.getAgenticPresets,
  });
}

/** One evaluator's detail view (statistics overview + recent evaluations) in a single request. */
export function useEvaluatorDetail(evaluatorId: string, range: RangeKey) {
  const params = useMemo(
    () => ({ from: rangeFrom(range), to: new Date().toISOString(), bucket: bucketFor(range) }),
    [range],
  );
  return useQuery({
    queryKey: QUERY_KEYS.evaluatorDetail(evaluatorId, range),
    queryFn: () => evaluatorsApi.detail(evaluatorId, params),
    retry: false,
    placeholderData: keepPreviousData,
  });
}

/**
 * Recent evaluations for one evaluator filtered to a single score. Used when the user clicks a
 * score-distribution bar — fetched server-side (not filtered from the last-8) so a score the
 * distribution shows over the range still surfaces matching results.
 */
export function useEvaluatorRecentByScore(evaluatorId: string, score: EvaluationScore | null, count = 20) {
  return useQuery({
    queryKey: QUERY_KEYS.evaluatorRecent(evaluatorId, score ?? 'all', count),
    queryFn: () => evaluatorsApi.recentEvaluations(evaluatorId, { count, score: score ?? undefined }),
    enabled: evaluatorId !== '' && score !== null,
    placeholderData: keepPreviousData,
  });
}
