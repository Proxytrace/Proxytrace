import { describe, it, expect } from 'vitest';
import { EvaluationScore, EvaluatorKind, TestRunStatus } from '../../api/models';
import type { EvaluationResultDto, TestResultDto, TestRunDto } from '../../api/models';
import {
  isErrored,
  isEvalPass,
  resultPass,
  resultScore,
  compositePercent,
  avgLatency,
  isActive,
  isDivergent,
} from './results';

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
