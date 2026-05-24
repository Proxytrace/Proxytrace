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
  isDivergent,
  buildMatrixRows,
  fixtureSummary,
  patchGroupsWithResult,
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
      passed: 0, total: 0, allPass: false, composite: null, totalCost: 0, totalTokens: 0,
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
  });
});

describe('buildMatrixRows', () => {
  function caseResult(testCaseId: string, summary: string, evals: EvaluationResultDto[]): TestResultDto {
    return { id: `${testCaseId}-r`, testCaseId, testCaseSummary: summary, actualResponse: '', evaluations: evals, durationMs: 100 };
  }
  function run(id: string, results: TestResultDto[], testCases: { id: string; summary: string }[] = []): TestRunDto {
    return { id, endpointName: id, results, testCases } as TestRunDto;
  }

  it('orders divergent cases before agreeing ones', () => {
    const r1 = run('m1', [caseResult('a', 'A', [PASS]), caseResult('b', 'B', [PASS])]);
    const r2 = run('m2', [caseResult('a', 'A', [FAIL]), caseResult('b', 'B', [PASS])]);
    const rows = buildMatrixRows([r1, r2]);
    expect(rows.map(r => r.caseId)).toEqual(['a', 'b']);
    expect(rows[0].divergent).toBe(true);
    expect(rows[1].divergent).toBe(false);
  });

  it('breaks ties among non-divergent rows by fail count', () => {
    const r1 = run('m1', [caseResult('ok', 'Zok', [PASS]), caseResult('bad', 'Abad', [FAIL])]);
    const r2 = run('m2', [caseResult('ok', 'Zok', [PASS]), caseResult('bad', 'Abad', [FAIL])]);
    const rows = buildMatrixRows([r1, r2]);
    expect(rows.map(r => r.caseId)).toEqual(['bad', 'ok']);
    expect(rows.every(r => r.divergent)).toBe(false);
  });

  it('emits null cells for a case missing from a run', () => {
    const cases = [{ id: 'a', summary: 'A' }, { id: 'b', summary: 'B' }];
    const r1 = run('m1', [caseResult('a', 'A', [PASS])], cases);
    const r2 = run('m2', [caseResult('a', 'A', [PASS])], cases);
    const bRow = buildMatrixRows([r1, r2]).find(r => r.caseId === 'b');
    expect(bRow?.summary).toBe('B');
    expect(bRow?.cells.every(c => c.result === null && c.pass === null)).toBe(true);
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
    const [ea, eb] = buildLeaderboard([a, b]);
    expect(ea.passRate).toBe(90);
    expect(ea.isBest).toBe(true);
    expect(eb.isFastest).toBe(true);
    expect(eb.isCheapest).toBe(true);
    expect(eb.deltaVsBest).toBe(30);
    expect(ea.deltaVsBest).toBeNull();
  });

  it('derives pending from totalCases minus delivered results', () => {
    const r = lbRun({ totalCases: 10, passedCases: 4, failedCases: 1, results: [{ testCaseId: 'c0' }, { testCaseId: 'c1' }, { testCaseId: 'c2' }, { testCaseId: 'c3' }, { testCaseId: 'c4' }] as TestResultDto[] });
    const [e] = buildLeaderboard([r]);
    expect(e.pending).toBe(5);
    expect(e.passRate).toBe(80); // 4 / (4+1)
  });

  it('excludes non-completed runs from winner selection', () => {
    const done = lbRun({ id: 'd', endpointName: 'd', passedCases: 5, failedCases: 5 });
    const running = lbRun({ id: 'x', endpointName: 'x', status: TestRunStatus.Running, passedCases: 10, failedCases: 0 });
    const entries = buildLeaderboard([done, running]);
    expect(entries.find(e => e.run.id === 'd')?.isBest).toBe(true);
    expect(entries.find(e => e.run.id === 'x')?.isBest).toBe(false);
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

  it('appends the result and recomputes pass/fail counts', () => {
    const next = patchGroupsWithResult(page({}), event({ evaluations: [PASS] }));
    const run = next.items[0].runs[0];
    expect(run.results).toHaveLength(1);
    expect(run.results[0]).toMatchObject({ testCaseId: 'c1', testCaseSummary: 'Case one', durationMs: 120 });
    expect(run.passedCases).toBe(1);
    expect(run.failedCases).toBe(0);
    expect(run.passRate).toBe(50);
  });

  it('counts a failing result against failedCases', () => {
    const run = patchGroupsWithResult(page({}), event({ evaluations: [FAIL] })).items[0].runs[0];
    expect(run.passedCases).toBe(0);
    expect(run.failedCases).toBe(1);
  });

  it('is idempotent when the result is already present', () => {
    const existing = page({ results: [{ ...result([PASS]), testCaseId: 'c1' } as TestResultDto], passedCases: 1, passRate: 50 });
    const next = patchGroupsWithResult(existing, event());
    expect(next.items[0].runs[0].results).toHaveLength(1);
  });

  it('leaves the data unchanged when the group is absent', () => {
    const input = page({});
    expect(patchGroupsWithResult(input, event({ groupId: 'other' }))).toEqual(input);
  });
});
