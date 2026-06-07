// Pure derive helpers for the multi-model comparison UI (leaderboard, evaluator
// heatmap, matrix filter/sort). Split from results.ts to stay within the file-size
// budget; unit-tested in results.spec.ts. No JSX, no I/O.

import { TestRunStatus, EvaluationScore } from '../../api/models';
import type {
  EvaluationResultDto,
  RunEvaluatorDto,
  TestRunDto,
  TestRunGroupDto,
} from '../../api/models';
import { passRatePercent, type MatrixRow } from './results';
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

export interface LeaderboardEntry {
  run: TestRunDto;
  passed: number;
  failed: number;
  pending: number;
  passRate: number | null;
  durationMs: number | null;
  costUsd: number | null;
  tokensIn: number | null;
  tokensOut: number | null;
  /** Winners among the group's *completed* runs (always set; render only when multi-model). */
  isBest: boolean;
  isFastest: boolean;
  isCheapest: boolean;
  /** Points below the best pass rate (≥ 0); `null` for the winner or when not comparable. */
  deltaVsBest: number | null;
}

/**
 * Derives the per-run comparison row shown in the leaderboard: pass/fail/pending
 * counts, pass rate, and run-level cost/token totals, plus best/fastest/cheapest
 * flags computed across the group's completed runs.
 */
export function buildLeaderboard(runs: TestRunDto[], complete: boolean): LeaderboardEntry[] {
  const base = runs.map(run => ({
    run,
    passed: run.passedCases,
    failed: run.failedCases,
    pending: Math.max(0, run.totalCases - run.results.length),
    passRate: passRatePercent(run.passedCases, run.passedCases + run.failedCases),
    durationMs: run.durationMs,
    costUsd: run.costUsd,
    tokensIn: run.tokensIn,
    tokensOut: run.tokensOut,
  }));

  // Winners are computed only once the whole group has settled — otherwise badges flip
  // between models on partial data every SSE frame.
  const pool = complete ? base.filter(e => e.run.status === TestRunStatus.Completed && e.passRate !== null) : [];
  const pick = <T>(items: T[], better: (a: T, b: T) => boolean): T | null =>
    items.reduce<T | null>((best, x) => (best === null || better(x, best) ? x : best), null);

  const best = pick(pool, (a, b) => (a.passRate as number) > (b.passRate as number));
  const fastest = pick(pool.filter(e => e.durationMs !== null), (a, b) => (a.durationMs as number) < (b.durationMs as number));
  const cheapest = pick(pool.filter(e => e.costUsd !== null), (a, b) => (a.costUsd as number) < (b.costUsd as number));

  return base.map(e => ({
    ...e,
    isBest: best?.run.id === e.run.id,
    isFastest: fastest?.run.id === e.run.id,
    isCheapest: cheapest?.run.id === e.run.id,
    deltaVsBest: best && best.run.id !== e.run.id && e.passRate !== null
      ? (best.passRate as number) - e.passRate
      : null,
  }));
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
 * For each evaluator (rows) × each run (columns), tallies how its judgements were
 * distributed across the score buckets, plus the per-cell judged total and pass rate.
 * `live` (optional) folds in evaluations that have arrived for in-flight cases, so the
 * distribution grows per evaluator *during* a run rather than jumping only when a case ends.
 */
export function buildEvaluatorHeatmap(group: TestRunGroupDto, live?: LiveProgress): HeatmapRow[] {
  const evaluators = new Map<string, RunEvaluatorDto>();
  group.runs.forEach(run => run.evaluators.forEach(ev => { if (!evaluators.has(ev.id)) evaluators.set(ev.id, ev); }));
  const liveByRun = groupLiveByRun(live);

  return [...evaluators.values()].map(evaluator => ({
    evaluator,
    cells: group.runs.map(run => {
      const dist = emptyDist();
      let total = 0;
      const tally = (e: { evaluatorId: string; errorMessage: string | null; score: EvaluationScore | null }) => {
        if (e.evaluatorId !== evaluator.id) return;
        const bucket: ScoreBucket = e.errorMessage !== null || e.score === null ? 'Error' : e.score;
        dist[bucket]++;
        total++;
      };
      run.results.forEach(res => res.evaluations.forEach(tally));
      (liveByRun.get(run.id) ?? []).forEach(tally);
      const passes = dist[EvaluationScore.Excellent] + dist[EvaluationScore.Good] + dist[EvaluationScore.Acceptable];
      return { run, dist, total, passRate: total > 0 ? Math.round((passes / total) * 100) : null };
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

// ── Matrix filter / sort ──────────────────────────────────────────────────────

export type MatrixFilter = 'all' | 'divergent' | 'failing' | 'passing';
export type MatrixSort = 'order' | 'worst';

const rowFailing = (row: MatrixRow): boolean => row.cells.some(c => c.pass === false);
const rowPassing = (row: MatrixRow): boolean =>
  row.cells.some(c => c.result) && row.cells.filter(c => c.result).every(c => c.pass === true);
const rowMinScore = (row: MatrixRow): number => {
  const scores = row.cells.filter(c => c.result).map(c => c.score ?? 0);
  return scores.length ? Math.min(...scores) : 1;
};

export interface MatrixCounts { all: number; divergent: number; failing: number; passing: number; }

export const matrixCounts = (rows: MatrixRow[]): MatrixCounts => ({
  all: rows.length,
  divergent: rows.filter(r => r.divergent).length,
  failing: rows.filter(rowFailing).length,
  passing: rows.filter(rowPassing).length,
});

/**
 * Applies the toolbar filter, then orders the rows. Input is in stable suite order
 * (see {@link buildMatrixRows}).
 *
 * - `freezeOrder` (set while a run is active) keeps that stable order so rows never reshuffle
 *   mid-run as partial verdicts arrive — the cause of "frantic" flicker under parallel runs.
 * - Otherwise `'order'` surfaces divergent rows first, then most failures, then alphabetical;
 *   `'worst'` orders by lowest per-cell score.
 */
export function filterSortMatrixRows(
  rows: MatrixRow[],
  filter: MatrixFilter,
  sort: MatrixSort,
  freezeOrder = false,
): MatrixRow[] {
  let out = rows;
  if (filter === 'divergent') out = out.filter(r => r.divergent);
  else if (filter === 'failing') out = out.filter(rowFailing);
  else if (filter === 'passing') out = out.filter(rowPassing);

  if (freezeOrder) return out;
  if (sort === 'worst') return [...out].sort((a, b) => rowMinScore(a) - rowMinScore(b));
  return [...out].sort((a, b) =>
    (Number(b.divergent) - Number(a.divergent)) || (b.failCount - a.failCount) || a.summary.localeCompare(b.summary));
}
