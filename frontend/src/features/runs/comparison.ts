// Pure derive helpers for the multi-model comparison UI (leaderboard, evaluator
// heatmap, matrix filter/sort). Split from results.ts to stay within the file-size
// budget; unit-tested in results.spec.ts. No JSX, no I/O.

import { TestRunStatus, EvaluationScore } from '../../api/models';
import type {
  EvaluationResultDto,
  RunEvaluatorDto,
  TestRunDto,
} from '../../api/models';
import { passRatePercent } from './results';
import type { Cohort } from './cohorts';
import type { LiveProgress } from './live';

const SUCCESS = 'var(--success)';
const WARN = 'var(--warn)';
const DANGER = 'var(--danger)';
const MUTED = 'var(--text-muted)';

// ── Score levels (evaluator heatmap) ─────────────────────────────────────────

/** A judged evaluation bucket: one of the five scores, or `Error` for failed runs. */
export type ScoreBucket = EvaluationScore | 'Error';

/** Best→worst order used for stacking distribution segments. */
export const SCORE_LEVELS: EvaluationScore[] = [
  EvaluationScore.Excellent,
  EvaluationScore.Good,
  EvaluationScore.Acceptable,
  EvaluationScore.Bad,
  EvaluationScore.Terrible,
];

export const SCORE_BUCKETS: ScoreBucket[] = [...SCORE_LEVELS, 'Error'];

/**
 * A 5-step pass→fail ramp built from the existing semantic tokens (no new tokens):
 * success at the top, danger at the bottom, warn in the middle, with mixed midpoints.
 * Returned as runtime color strings (data-driven) for inline `style` use.
 */
export function scoreBucketColor(bucket: ScoreBucket): string {
  switch (bucket) {
    case EvaluationScore.Excellent: return SUCCESS;
    case EvaluationScore.Good: return 'color-mix(in srgb, var(--success) 65%, var(--warn))';
    case EvaluationScore.Acceptable: return WARN;
    case EvaluationScore.Bad: return 'color-mix(in srgb, var(--danger) 60%, var(--warn))';
    case EvaluationScore.Terrible: return DANGER;
    default: return MUTED;
  }
}

// ── Model leaderboard (per-run comparison cards) ──────────────────────────────

/**
 * Signed comparison of one candidate model against the baseline (the in-production model,
 * or — when the group doesn't include it — the best performer). Each `*Better` flag is `true`
 * when the candidate wins that axis, `false` when it loses, and `null` when tied or not
 * comparable. Magnitudes are kept raw so the view formats + translates them at the leaf.
 */
export interface MetricDeltas {
  /** candidate − baseline, in pass-rate percentage points. */
  passPoints: number | null;
  passBetter: boolean | null;
  /** baseline − candidate, in ms (positive ⇒ candidate is faster). */
  durationMs: number | null;
  durationBetter: boolean | null;
  /** 1 − candidate/baseline cost (positive ⇒ candidate is cheaper). */
  costFraction: number | null;
  costBetter: boolean | null;
}

export interface LeaderboardEntry {
  /** The cohort's representative run — carries the endpoint identity the card renders. */
  run: TestRunDto;
  /** Samples averaged into this entry (1 for an un-sampled endpoint). */
  sampleCount: number;
  passed: number;
  failed: number;
  pending: number;
  passRate: number | null;
  durationMs: number | null;
  costUsd: number | null;
  tokensIn: number | null;
  tokensOut: number | null;
  cachedTokensIn: number | null;
  /** Winners among the group's *completed* runs (always set; render only when multi-model). */
  isBest: boolean;
  isFastest: boolean;
  isCheapest: boolean;
  /** This run is the comparison baseline (the champion panel) — the model others read against. */
  isBaseline: boolean;
  /** The baseline is the agent's currently-deployed endpoint ("in production"), not a fallback. */
  isProduction: boolean;
  /** Candidate's deltas vs the baseline; `null` for the baseline itself or before the group settles. */
  delta: MetricDeltas | null;
}

type LbBase = Omit<LeaderboardEntry, 'isBest' | 'isFastest' | 'isCheapest' | 'isBaseline' | 'isProduction' | 'delta'>;

const dir = (n: number | null): boolean | null => (n === null ? null : n > 0 ? true : n < 0 ? false : null);

const meanOf = (vals: (number | null)[]): number | null => {
  const present = vals.filter((x): x is number => x !== null);
  return present.length ? present.reduce((a, b) => a + b, 0) / present.length : null;
};

const roundOrNull = (n: number | null): number | null => (n === null ? null : Math.round(n));

/** Averages a cohort's samples into one comparison row: mean pass rate, duration, cost and tokens. */
function aggregateCohort(cohort: Cohort<TestRunDto>): LbBase {
  const runs = cohort.runs;
  return {
    run: cohort.representative,
    sampleCount: cohort.sampleCount,
    passed: Math.round(meanOf(runs.map(r => r.passedCases)) ?? 0),
    failed: Math.round(meanOf(runs.map(r => r.failedCases)) ?? 0),
    pending: Math.round(meanOf(runs.map(r => Math.max(0, r.totalCases - r.results.length))) ?? 0),
    // Round the cohort mean: averaging already-rounded per-sample percentages otherwise yields
    // values like 96.6666… that leak straight into the pass-rate cards.
    passRate: roundOrNull(meanOf(runs.map(r => passRatePercent(r.passedCases, r.passedCases + r.failedCases)))),
    durationMs: meanOf(runs.map(r => r.durationMs)),
    costUsd: meanOf(runs.map(r => r.costUsd)),
    tokensIn: meanOf(runs.map(r => r.tokensIn)),
    tokensOut: meanOf(runs.map(r => r.tokensOut)),
    cachedTokensIn: meanOf(runs.map(r => r.cachedTokensIn)),
  };
}

/** Raw per-axis deltas of a candidate against the baseline (see {@link MetricDeltas}). */
function deltaVsBaseline(e: LbBase, base: LbBase): MetricDeltas {
  const passPoints = e.passRate !== null && base.passRate !== null ? e.passRate - base.passRate : null;
  const durationMs = e.durationMs !== null && base.durationMs !== null ? base.durationMs - e.durationMs : null;
  const costFraction = e.costUsd !== null && base.costUsd !== null && base.costUsd > 0 ? 1 - e.costUsd / base.costUsd : null;
  return {
    passPoints, passBetter: dir(passPoints),
    durationMs, durationBetter: dir(durationMs),
    costFraction, costBetter: dir(costFraction),
  };
}

/**
 * Derives the per-run comparison rows shown above the matrix: pass/fail/pending counts, pass rate,
 * and run-level cost/token totals, plus best/fastest/cheapest flags and the baseline framing.
 *
 * The **baseline** (the champion panel) is the run on the agent's currently-deployed endpoint —
 * `currentEndpointId`, the model in production — so candidates read as deltas *vs what we ship*.
 * When the group doesn't include that model (a candidates-only comparison) the baseline falls back
 * to the best pass rate. Winners and deltas are conclusions, so they only resolve once the whole
 * group has settled (`complete`); the in-production baseline is known immediately, the fallback is not.
 */
export function buildLeaderboard(
  cohorts: Cohort<TestRunDto>[],
  complete: boolean,
  currentEndpointId: string | null = null,
): LeaderboardEntry[] {
  const rows = cohorts.map(cohort => ({ base: aggregateCohort(cohort), cohort }));
  const base: LbBase[] = rows.map(r => r.base);

  // Winners are computed only once the whole group has settled — otherwise badges flip
  // between models on partial data every SSE frame. A cohort qualifies only when all its samples
  // completed (a half-sampled endpoint isn't yet comparable).
  const pool = complete
    ? rows
      .filter(r => r.cohort.runs.every(run => run.status === TestRunStatus.Completed) && r.base.passRate !== null)
      .map(r => r.base)
    : [];
  const pick = (items: LbBase[], better: (a: LbBase, b: LbBase) => boolean): LbBase | null =>
    items.reduce<LbBase | null>((best, x) => (best === null || better(x, best) ? x : best), null);

  const best = pick(pool, (a, b) => (a.passRate as number) > (b.passRate as number));
  const fastest = pick(pool.filter(e => e.durationMs !== null), (a, b) => (a.durationMs as number) < (b.durationMs as number));
  const cheapest = pick(pool.filter(e => e.costUsd !== null), (a, b) => (a.costUsd as number) < (b.costUsd as number));

  // Baseline = the in-production model if it's in the group; otherwise the best performer (known
  // only once complete). Production is identified by endpoint id and so is known even mid-run.
  const production = currentEndpointId ? base.find(e => e.run.endpointId === currentEndpointId) ?? null : null;
  const baseline = production ?? best;
  const baselineId = baseline?.run.id ?? null;

  return base.map(e => ({
    ...e,
    isBest: best?.run.id === e.run.id,
    isFastest: fastest?.run.id === e.run.id,
    isCheapest: cheapest?.run.id === e.run.id,
    isBaseline: baselineId !== null && e.run.id === baselineId,
    isProduction: production !== null && e.run.id === baselineId,
    delta: complete && baseline && e.run.id !== baselineId ? deltaVsBaseline(e, baseline) : null,
  }));
}

/**
 * Grid track template + the container-query breakpoint class for the comparison cards. The baseline
 * leads in a wider first column; without one (a candidates-only group mid-run), columns are even.
 * Below the breakpoint the cards stack. Returned as plain strings so the view stays declarative.
 */
export function comparisonGrid(count: number, hasBaseline: boolean): { cols: string; breakpoint: string } {
  const cols = !hasBaseline
    ? `repeat(${count}, minmax(0, 1fr))`
    : count <= 1
      ? 'minmax(0, 1fr)'
      : count === 2
        ? '1.2fr 1fr'
        : `1.3fr repeat(${count - 1}, minmax(0, 1fr))`;
  const breakpoint = count >= 3
    ? '@3xl:[grid-template-columns:var(--cmp-cols)]'
    : '@xl:[grid-template-columns:var(--cmp-cols)]';
  return { cols, breakpoint };
}

// ── Evaluator heatmap (score distribution per evaluator × model) ──────────────

export interface HeatmapCell {
  run: TestRunDto;
  dist: Record<ScoreBucket, number>;
  total: number;
  passRate: number | null;
}

export interface HeatmapRow {
  evaluator: RunEvaluatorDto;
  cells: HeatmapCell[];
}

const emptyDist = (): Record<ScoreBucket, number> =>
  SCORE_BUCKETS.reduce((acc, b) => { acc[b] = 0; return acc; }, {} as Record<ScoreBucket, number>);

/**
 * For each evaluator (rows) × each endpoint cohort (columns), tallies how its judgements were
 * distributed across the score buckets, pooling every sample in the cohort — so a flaky evaluator
 * shows as a split distribution (e.g. 3/5 Excellent + 2/5 Bad). `live` (optional) folds in evaluations
 * that have arrived for in-flight cases. The cell's `run` is the cohort representative (column label).
 */
export function buildEvaluatorHeatmap(cohorts: Cohort<TestRunDto>[], live?: LiveProgress): HeatmapRow[] {
  const evaluators = new Map<string, RunEvaluatorDto>();
  cohorts.forEach(cohort => cohort.runs.forEach(run =>
    run.evaluators.forEach(ev => { if (!evaluators.has(ev.id)) evaluators.set(ev.id, ev); })));
  const liveByRun = groupLiveByRun(live);

  return [...evaluators.values()].map(evaluator => ({
    evaluator,
    cells: cohorts.map(cohort => {
      const dist = emptyDist();
      let total = 0;
      const tally = (e: { evaluatorId: string; errorMessage: string | null; score: EvaluationScore | null }) => {
        if (e.evaluatorId !== evaluator.id) return;
        const bucket: ScoreBucket = e.errorMessage !== null || e.score === null ? 'Error' : e.score;
        dist[bucket]++;
        total++;
      };
      cohort.runs.forEach(run => {
        run.results.forEach(res => res.evaluations.forEach(tally));
        (liveByRun.get(run.id) ?? []).forEach(tally);
      });
      const passes = dist[EvaluationScore.Excellent] + dist[EvaluationScore.Good] + dist[EvaluationScore.Acceptable];
      return { run: cohort.representative, dist, total, passRate: total > 0 ? Math.round((passes / total) * 100) : null };
    }),
  }));
}

/** Buckets all in-flight evaluations by their run id for the heatmap tally. */
function groupLiveByRun(live: LiveProgress | undefined): Map<string, EvaluationResultDto[]> {
  const byRun = new Map<string, EvaluationResultDto[]>();
  if (!live) return byRun;
  for (const liveCase of live.values()) {
    const bucket = byRun.get(liveCase.runId) ?? [];
    bucket.push(...liveCase.evaluations);
    byRun.set(liveCase.runId, bucket);
  }
  return byRun;
}
