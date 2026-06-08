import { describe, it, expect } from 'vitest';
import { EvaluationScore, EvaluatorKind, TestRunStatus } from '../../api/models';
import type {
  EvaluationResultDto,
  PagedResult,
  TestCaseFixtureDto,
  TestResultArrivedEvent,
  TestResultDto,
  TestRunDto,
  TestRunGroupDto,
} from '../../api/models';
import {
  isErrored,
  isEvalPass,
  resultPass,
  resultScore,
  compositePercent,
  avgLatency,
  isActive,
  runsComplete,
  runGroupProgress,
  isDivergent,
  buildMatrixRows,
  fixtureSummary,
  patchGroupsWithResult,
  patchGroupsRunStatus,
  scoreLabel,
} from './results';
import {
  buildLeaderboard,
  buildEvaluatorHeatmap,
  matrixCounts,
  filterSortMatrixRows,
} from './comparison';

function evaluation(over: Partial<EvaluationResultDto> = {}): EvaluationResultDto {
  return {
    evaluatorId: 'ev',
    evaluatorKind: EvaluatorKind.ExactMatch,
    evaluatorName: 'Exact',
    score: EvaluationScore.Good,
    reasoning: null,
    errorMessage: null,
    ...over,
  };
}

function result(evaluations: EvaluationResultDto[], durationMs = 100): TestResultDto {
  return {
    id: 'r',
    testCaseId: 'c',
    testCaseSummary: 'case',
    actualResponse: '',
    evaluations,
    durationMs,
  };
}

const PASS = evaluation({ score: EvaluationScore.Good });
const FAIL = evaluation({ score: EvaluationScore.Bad });
const ERR = evaluation({ score: null, errorMessage: 'boom' });

describe('isErrored / isEvalPass', () => {
  it('treats a non-null errorMessage as errored and not passing', () => {
    expect(isErrored(ERR)).toBe(true);
    expect(isEvalPass(ERR)).toBe(false);
  });

  it('passes only for passing scores', () => {
    expect(isEvalPass(evaluation({ score: EvaluationScore.Excellent }))).toBe(true);
    expect(isEvalPass(evaluation({ score: EvaluationScore.Acceptable }))).toBe(true);
    expect(isEvalPass(evaluation({ score: EvaluationScore.Bad }))).toBe(false);
    expect(isEvalPass(evaluation({ score: null }))).toBe(false);
  });
});

describe('resultPass', () => {
  it('returns null when there are no evaluators', () => {
    expect(resultPass(result([]))).toBeNull();
  });

  it('passes only when every evaluator passes', () => {
    expect(resultPass(result([PASS, PASS]))).toBe(true);
    expect(resultPass(result([PASS, FAIL]))).toBe(false);
    expect(resultPass(result([PASS, ERR]))).toBe(false);
  });
});

describe('resultScore', () => {
  it('returns null when there are no evaluators', () => {
    expect(resultScore(result([]))).toBeNull();
  });

  it('is the fraction of passing evaluators, counting errored as non-pass', () => {
    expect(resultScore(result([PASS, PASS]))).toBe(1);
    expect(resultScore(result([PASS, FAIL]))).toBe(0.5);
    expect(resultScore(result([PASS, ERR]))).toBe(0.5);
    expect(resultScore(result([ERR, ERR]))).toBe(0);
  });
});

describe('compositePercent', () => {
  it('rounds passed/total to a percent', () => {
    expect(compositePercent(1, 2)).toBe(50);
    expect(compositePercent(2, 3)).toBe(67);
  });

  it('returns null when total is zero', () => {
    expect(compositePercent(0, 0)).toBeNull();
  });
});

describe('avgLatency', () => {
  it('averages result durations', () => {
    const run = { results: [result([], 100), result([], 300)] } as TestRunDto;
    expect(avgLatency(run)).toBe(200);
  });

  it('returns null with no results', () => {
    expect(avgLatency({ results: [] } as unknown as TestRunDto)).toBeNull();
  });
});

describe('isActive', () => {
  it('is true for running and pending only', () => {
    expect(isActive(TestRunStatus.Running)).toBe(true);
    expect(isActive(TestRunStatus.Pending)).toBe(true);
    expect(isActive(TestRunStatus.Completed)).toBe(false);
    expect(isActive(TestRunStatus.Failed)).toBe(false);
  });
});

describe('runsComplete', () => {
  const r = (status: TestRunStatus): TestRunDto => ({ status } as TestRunDto);

  it('is false when there are no runs', () => {
    expect(runsComplete([])).toBe(false);
  });

  it('is false while any run is pending or running', () => {
    expect(runsComplete([r(TestRunStatus.Completed), r(TestRunStatus.Running)])).toBe(false);
    expect(runsComplete([r(TestRunStatus.Pending)])).toBe(false);
  });

  it('is true once every run is in a terminal state', () => {
    expect(runsComplete([r(TestRunStatus.Completed), r(TestRunStatus.Failed)])).toBe(true);
  });
});

describe('runGroupProgress', () => {
  const run = (totalCases: number, durations: number[]): TestRunDto => ({
    totalCases,
    results: durations.map((durationMs, i) => ({ testCaseId: `c${i}`, durationMs })),
  } as TestRunDto);

  it('returns zeroed progress with no ETA before anything runs', () => {
    expect(runGroupProgress([run(4, [])])).toEqual({ done: 0, total: 4, percent: 0, etaMs: null });
  });

  it('sums done/total across runs and computes percent', () => {
    const p = runGroupProgress([run(4, [100, 100]), run(4, [100])]);
    expect(p.done).toBe(3);
    expect(p.total).toBe(8);
    expect(p.percent).toBe(38); // round(3/8 * 100)
  });

  it('estimates ETA from average case duration times remaining cases', () => {
    const p = runGroupProgress([run(4, [200, 200])]); // avg 200ms, 2 remaining
    expect(p.etaMs).toBe(400);
  });

  it('has no ETA once everything is done', () => {
    expect(runGroupProgress([run(2, [100, 100])]).etaMs).toBeNull();
  });
});

describe('isDivergent', () => {
  it('is true only when both pass and fail are present', () => {
    expect(isDivergent([true, false])).toBe(true);
    expect(isDivergent([true, true])).toBe(false);
    expect(isDivergent([false, false])).toBe(false);
    expect(isDivergent([])).toBe(false);
  });
});

describe('fixtureSummary', () => {
  function fixture(evals: boolean[], endpoints: { costUsd: number; tokIn: number; tokOut: number }[]): TestCaseFixtureDto {
    return {
      evaluators: evals.map(pass => ({ pass })),
      endpoints,
    } as unknown as TestCaseFixtureDto;
  }

  it('zeroes everything when the fixture is undefined', () => {
    expect(fixtureSummary(undefined)).toEqual({
      passed: 0, total: 0, allPass: false, composite: null, totalCost: 0, totalTokens: 0, tokensOut: 0,
    });
  });

  it('marks allPass and 100% only when every evaluator passes', () => {
    const s = fixtureSummary(fixture([true, true], []));
    expect(s).toMatchObject({ passed: 2, total: 2, allPass: true, composite: 100 });
  });

  it('computes a partial composite and sums cost and tokens', () => {
    const s = fixtureSummary(fixture([true, false], [
      { costUsd: 0.01, tokIn: 10, tokOut: 5 },
      { costUsd: 0.02, tokIn: 20, tokOut: 5 },
    ]));
    expect(s).toMatchObject({ passed: 1, total: 2, allPass: false, composite: 50 });
    expect(s.totalCost).toBeCloseTo(0.03);
    expect(s.totalTokens).toBe(40);
    expect(s.tokensOut).toBe(10);
  });
});

describe('scoreLabel', () => {
  it('maps each backend score ordinal (1..5) to its label', () => {
    expect(scoreLabel(1)).toBe(EvaluationScore.Terrible);
    expect(scoreLabel(2)).toBe(EvaluationScore.Bad);
    expect(scoreLabel(3)).toBe(EvaluationScore.Acceptable);
    expect(scoreLabel(4)).toBe(EvaluationScore.Good);
    expect(scoreLabel(5)).toBe(EvaluationScore.Excellent);
  });

  it('returns "—" for null and the raw number for out-of-range values', () => {
    expect(scoreLabel(null)).toBe('—');
    expect(scoreLabel(7)).toBe('7');
  });
});

describe('buildMatrixRows', () => {
  function caseResult(testCaseId: string, summary: string, evals: EvaluationResultDto[]): TestResultDto {
    return { id: `${testCaseId}-r`, testCaseId, testCaseSummary: summary, actualResponse: '', evaluations: evals, durationMs: 100 };
  }
  function run(id: string, results: TestResultDto[], testCases: { id: string; summary: string }[] = [], evaluatorCount = 0): TestRunDto {
    return { id, endpointName: id, results, testCases, evaluators: new Array(evaluatorCount).fill({ id: 'ev', kind: EvaluatorKind.ExactMatch, name: 'E' }) } as TestRunDto;
  }

  it('keeps stable suite order (no reshuffle) and flags divergence per row', () => {
    const r1 = run('m1', [caseResult('a', 'A', [PASS]), caseResult('b', 'B', [PASS])]);
    const r2 = run('m2', [caseResult('a', 'A', [FAIL]), caseResult('b', 'B', [PASS])]);
    const rows = buildMatrixRows([r1, r2]);
    expect(rows.map(r => r.caseId)).toEqual(['a', 'b']);
    expect(rows.find(r => r.caseId === 'a')?.divergent).toBe(true);
    expect(rows.find(r => r.caseId === 'b')?.divergent).toBe(false);
  });

  it('does not reorder by fail count — ordering is left to filterSortMatrixRows', () => {
    const r1 = run('m1', [caseResult('ok', 'Zok', [PASS]), caseResult('bad', 'Abad', [FAIL])]);
    const rows = buildMatrixRows([r1]);
    expect(rows.map(r => r.caseId)).toEqual(['ok', 'bad']); // insertion order, not fail-count order
  });

  it('emits null cells for a case missing from a run', () => {
    const cases = [{ id: 'a', summary: 'A' }, { id: 'b', summary: 'B' }];
    const r1 = run('m1', [caseResult('a', 'A', [PASS])], cases);
    const r2 = run('m2', [caseResult('a', 'A', [PASS])], cases);
    const bRow = buildMatrixRows([r1, r2]).find(r => r.caseId === 'b');
    expect(bRow?.summary).toBe('B');
    expect(bRow?.cells.every(c => c.result === null && c.pass === null)).toBe(true);
  });

  it('gives pending cells a zero-of-N evaluator slot count', () => {
    const cases = [{ id: 'a', summary: 'A' }];
    const r = run('m1', [], cases, 3); // 3 evaluators, no results yet
    const cell = buildMatrixRows([r])[0].cells[0];
    expect(cell.status).toBe('pending');
    expect(cell.progress).toEqual({ done: 0, total: 3 });
  });
});

describe('buildLeaderboard', () => {
  function lbRun(over: Partial<TestRunDto>): TestRunDto {
    return {
      id: 'r', endpointName: 'm', status: TestRunStatus.Completed,
      totalCases: 10, passedCases: 8, failedCases: 2, results: new Array(10).fill(0).map((_, i) => ({ testCaseId: `c${i}` })),
      durationMs: 1000, costUsd: 0.5, tokensIn: 100, tokensOut: 50, ...over,
    } as TestRunDto;
  }

  it('flags best pass rate, fastest and cheapest among completed runs', () => {
    const a = lbRun({ id: 'a', endpointName: 'a', passedCases: 9, failedCases: 1, durationMs: 3000, costUsd: 0.9 });
    const b = lbRun({ id: 'b', endpointName: 'b', passedCases: 6, failedCases: 4, durationMs: 1000, costUsd: 0.1 });
    const [ea, eb] = buildLeaderboard([a, b], true);
    expect(ea.passRate).toBe(90);
    expect(ea.isBest).toBe(true);
    expect(eb.isFastest).toBe(true);
    expect(eb.isCheapest).toBe(true);
    expect(eb.deltaVsBest).toBe(30);
    expect(ea.deltaVsBest).toBeNull();
  });

  it('derives pending from totalCases minus delivered results', () => {
    const r = lbRun({ totalCases: 10, passedCases: 4, failedCases: 1, results: [{ testCaseId: 'c0' }, { testCaseId: 'c1' }, { testCaseId: 'c2' }, { testCaseId: 'c3' }, { testCaseId: 'c4' }] as TestResultDto[] });
    const [e] = buildLeaderboard([r], true);
    expect(e.pending).toBe(5);
    expect(e.passRate).toBe(80); // 4 / (4+1)
  });

  it('excludes non-completed runs from winner selection', () => {
    const done = lbRun({ id: 'd', endpointName: 'd', passedCases: 5, failedCases: 5 });
    const running = lbRun({ id: 'x', endpointName: 'x', status: TestRunStatus.Running, passedCases: 10, failedCases: 0 });
    const entries = buildLeaderboard([done, running], true);
    expect(entries.find(e => e.run.id === 'd')?.isBest).toBe(true);
    expect(entries.find(e => e.run.id === 'x')?.isBest).toBe(false);
  });

  it('reports no winners and null deltas while the group is not yet complete', () => {
    const a = lbRun({ id: 'a', endpointName: 'a', passedCases: 9, failedCases: 1, durationMs: 1000, costUsd: 0.1 });
    const b = lbRun({ id: 'b', endpointName: 'b', passedCases: 6, failedCases: 4, durationMs: 3000, costUsd: 0.9 });
    const entries = buildLeaderboard([a, b], false);
    expect(entries.every(e => !e.isBest && !e.isFastest && !e.isCheapest)).toBe(true);
    expect(entries.every(e => e.deltaVsBest === null)).toBe(true);
    expect(entries.find(e => e.run.id === 'a')?.passRate).toBe(90);
  });
});

describe('buildEvaluatorHeatmap', () => {
  function hmRun(id: string, evaluations: EvaluationResultDto[][]): TestRunDto {
    return {
      id, endpointName: id, status: TestRunStatus.Completed,
      evaluators: [{ id: 'ev', kind: EvaluatorKind.ExactMatch, name: 'Exact' }],
      results: evaluations.map((evals, i) => ({ id: `${id}-${i}`, testCaseId: `c${i}`, testCaseSummary: '', actualResponse: '', evaluations: evals, durationMs: 1 })),
    } as TestRunDto;
  }

  it('tallies score buckets and pass rate per evaluator × model', () => {
    const run = hmRun('m', [
      [evaluation({ score: EvaluationScore.Excellent })],
      [evaluation({ score: EvaluationScore.Bad })],
      [evaluation({ score: null, errorMessage: 'boom' })],
    ]);
    const group = { runs: [run] } as TestRunGroupDto;
    const [row] = buildEvaluatorHeatmap(group);
    expect(row.evaluator.name).toBe('Exact');
    const cell = row.cells[0];
    expect(cell.total).toBe(3);
    expect(cell.dist[EvaluationScore.Excellent]).toBe(1);
    expect(cell.dist[EvaluationScore.Bad]).toBe(1);
    expect(cell.dist.Error).toBe(1);
    expect(cell.passRate).toBe(33); // 1 of 3 passing
  });

  it('returns a null pass rate for a model with no judgements', () => {
    const group = { runs: [hmRun('m', [])] } as TestRunGroupDto;
    const [row] = buildEvaluatorHeatmap(group);
    expect(row.cells[0].passRate).toBeNull();
  });

  it('folds live in-flight evaluations into the distribution', () => {
    const group = { runs: [hmRun('m', [[evaluation({ score: EvaluationScore.Good })]])] } as TestRunGroupDto;
    const live = new Map([['m:c-live', {
      runId: 'm', testCaseId: 'c-live', inferenceDone: true,
      evaluations: [evaluation({ evaluatorId: 'ev', score: EvaluationScore.Bad })],
    }]]);
    const [row] = buildEvaluatorHeatmap(group, live);
    const cell = row.cells[0];
    expect(cell.total).toBe(2); // one finalized + one live
    expect(cell.dist[EvaluationScore.Good]).toBe(1);
    expect(cell.dist[EvaluationScore.Bad]).toBe(1);
  });
});

describe('matrixCounts / filterSortMatrixRows', () => {
  function cr(testCaseId: string, evals: EvaluationResultDto[]): TestResultDto {
    return { id: `${testCaseId}-r`, testCaseId, testCaseSummary: testCaseId, actualResponse: '', evaluations: evals, durationMs: 100 };
  }
  function run(id: string, results: TestResultDto[]): TestRunDto {
    return { id, endpointName: id, results, testCases: [] as { id: string; summary: string }[] } as TestRunDto;
  }
  // a: divergent (pass/fail), b: all fail, c: all pass
  const r1 = run('m1', [cr('a', [PASS]), cr('b', [FAIL]), cr('c', [PASS])]);
  const r2 = run('m2', [cr('a', [FAIL]), cr('b', [FAIL]), cr('c', [PASS])]);
  const rows = buildMatrixRows([r1, r2]);

  it('counts each filter category', () => {
    expect(matrixCounts(rows)).toEqual({ all: 3, divergent: 1, failing: 2, passing: 1 });
  });

  it('orders divergent first, then by fail count (sort=order)', () => {
    // buildMatrixRows gives stable [a, b, c]; sort=order surfaces divergent a, then b (a fail), then c.
    expect(filterSortMatrixRows(rows, 'all', 'order').map(r => r.caseId)).toEqual(['a', 'b', 'c']);
  });

  it('freezeOrder keeps the stable suite order regardless of sort', () => {
    const stable = buildMatrixRows([run('m1', [cr('z', [FAIL]), cr('a', [PASS])])]);
    expect(filterSortMatrixRows(stable, 'all', 'order', true).map(r => r.caseId)).toEqual(['z', 'a']);
  });

  it('filters to divergent / failing / passing', () => {
    expect(filterSortMatrixRows(rows, 'divergent', 'order').map(r => r.caseId)).toEqual(['a']);
    expect(filterSortMatrixRows(rows, 'passing', 'order').map(r => r.caseId)).toEqual(['c']);
    expect(filterSortMatrixRows(rows, 'failing', 'order').map(r => r.caseId).sort()).toEqual(['a', 'b']);
  });

  it('sorts worst-first by minimum cell score', () => {
    // distinct per-cell scores: b → 0, a → 0.5, c → 1
    const wr = run('m', [cr('a', [PASS, FAIL]), cr('b', [FAIL, FAIL]), cr('c', [PASS, PASS])]);
    const worst = filterSortMatrixRows(buildMatrixRows([wr]), 'all', 'worst').map(r => r.caseId);
    expect(worst).toEqual(['b', 'a', 'c']);
  });
});

describe('patchGroupsWithResult', () => {
  function page(run: Partial<TestRunDto>): PagedResult<TestRunGroupDto> {
    const fullRun = {
      id: 'run1', totalCases: 2, passedCases: 0, failedCases: 0, passRate: 0,
      testCases: [{ id: 'c1', summary: 'Case one' }, { id: 'c2', summary: 'Case two' }],
      results: [], ...run,
    } as TestRunDto;
    return { items: [{ id: 'g1', runs: [fullRun] } as TestRunGroupDto], total: 1, page: 1, pageSize: 20 };
  }

  function event(over: Partial<TestResultArrivedEvent> = {}): TestResultArrivedEvent {
    return {
      type: 'test-result-arrived', runId: 'run1', groupId: 'g1', testCaseId: 'c1',
      overallScore: EvaluationScore.Good, evaluations: [PASS], durationMs: 120, ...over,
    };
  }

  it('appends the result and recomputes counts with a judged-case pass rate', () => {
    const next = patchGroupsWithResult(page({}), event({ evaluations: [PASS] }));
    const run = next.items[0].runs[0];
    expect(run.results).toHaveLength(1);
    expect(run.results[0]).toMatchObject({ testCaseId: 'c1', testCaseSummary: 'Case one', durationMs: 120 });
    expect(run.passedCases).toBe(1);
    expect(run.failedCases).toBe(0);
    // 1 of 1 judged case passed — not 1 of 2 total. The running rate matches the final rate.
    expect(run.passRate).toBe(100);
  });

  it('counts a failing result against failedCases', () => {
    const run = patchGroupsWithResult(page({}), event({ evaluations: [FAIL] })).items[0].runs[0];
    expect(run.passedCases).toBe(0);
    expect(run.failedCases).toBe(1);
  });

  it('replaces an already-present result instead of dropping the late event', () => {
    const existing = page({ results: [{ ...result([FAIL]), testCaseId: 'c1' } as TestResultDto], passedCases: 0, failedCases: 1, passRate: 0 });
    const next = patchGroupsWithResult(existing, event({ evaluations: [PASS] })).items[0].runs[0];
    expect(next.results).toHaveLength(1);
    expect(next.passedCases).toBe(1);
    expect(next.failedCases).toBe(0);
  });

  it('leaves the data unchanged when the group is absent', () => {
    const input = page({});
    expect(patchGroupsWithResult(input, event({ groupId: 'other' }))).toEqual(input);
  });

  it('flips a run’s status on run-complete', () => {
    const next = patchGroupsRunStatus(page({}), {
      type: 'run-complete', runId: 'run1', groupId: 'g1', status: TestRunStatus.Completed, completedAt: '2024-01-01T00:00:00Z',
    });
    expect(next.items[0].runs[0].status).toBe(TestRunStatus.Completed);
    expect(next.items[0].runs[0].completedAt).toBe('2024-01-01T00:00:00Z');
  });
});

describe('buildMatrixRows live overlay', () => {
  function run(id: string, results: TestResultDto[], evaluatorCount = 2): TestRunDto {
    return {
      id, endpointName: id, results,
      testCases: [{ id: 'c1', summary: 'Case one' }],
      evaluators: new Array(evaluatorCount).fill(0).map((_, i) => ({ id: `ev${i}` })),
    } as TestRunDto;
  }

  it('marks a case with no result but live progress as running with per-evaluator progress', () => {
    const live = new Map([['r:c1', { runId: 'r', testCaseId: 'c1', evaluations: [{ evaluatorId: 'ev0' } as EvaluationResultDto], inferenceDone: true }]]);
    const [row] = buildMatrixRows([run('r', [])], live);
    expect(row.cells[0].status).toBe('running');
    expect(row.cells[0].progress).toEqual({ done: 1, total: 2 });
    expect(row.cells[0].pass).toBeNull();
  });

  it('marks a case with no result and no live entry as pending', () => {
    const [row] = buildMatrixRows([run('r', [])]);
    expect(row.cells[0].status).toBe('pending');
  });

  it('marks a finalized case as done regardless of live state', () => {
    const finalized = { id: 'c1-r', testCaseId: 'c1', testCaseSummary: 'Case one', actualResponse: '', evaluations: [PASS], durationMs: 1 } as TestResultDto;
    const live = new Map([['r:c1', { runId: 'r', testCaseId: 'c1', evaluations: [], inferenceDone: true }]]);
    const [row] = buildMatrixRows([run('r', [finalized])], live);
    expect(row.cells[0].status).toBe('done');
    expect(row.cells[0].pass).toBe(true);
  });
});
