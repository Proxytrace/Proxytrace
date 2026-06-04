import { describe, it, expect } from 'vitest';
import { EvaluationScore, EvaluatorKind, TestRunStatus } from '../../../../api/models';
import type {
  EvaluationResultDto,
  GroupRunCompleteEvent,
  RunCompleteEvent,
  TestResultArrivedEvent,
  TestRunDto,
  TestRunGroupDto,
} from '../../../../api/models';
import { applyGroupComplete, applyRunComplete, groupProgress, patchGroupWithResult } from './live-run-progress';

const PASS: EvaluationResultDto = {
  evaluatorId: 'ev', evaluatorKind: EvaluatorKind.ExactMatch, evaluatorName: 'Exact',
  score: EvaluationScore.Good, reasoning: null, errorMessage: null,
};
const FAIL: EvaluationResultDto = { ...PASS, score: EvaluationScore.Bad };

function group(over: Partial<TestRunDto> = {}): TestRunGroupDto {
  const run = {
    id: 'run1', groupId: 'g1', status: TestRunStatus.Running, totalCases: 2, passedCases: 0,
    failedCases: 0, passRate: 0, completedAt: null,
    testCases: [{ id: 'c1', summary: 'Case one' }, { id: 'c2', summary: 'Case two' }],
    results: [], ...over,
  } as TestRunDto;
  return { id: 'g1', agentId: 'a1', status: TestRunStatus.Running, completedAt: null, runs: [run] } as TestRunGroupDto;
}

function arrived(over: Partial<TestResultArrivedEvent> = {}): TestResultArrivedEvent {
  return {
    type: 'test-result-arrived', runId: 'run1', groupId: 'g1', testCaseId: 'c1',
    overallScore: EvaluationScore.Good, evaluations: [PASS], durationMs: 90, ...over,
  };
}

describe('groupProgress', () => {
  it('sums total cases and counts completed pass/fail', () => {
    const g = patchGroupWithResult(group(), arrived({ evaluations: [PASS] }));
    const p = groupProgress(g);
    expect(p).toMatchObject({ total: 2, completed: 1, passed: 1, failed: 0, percent: 50, passPercent: 100 });
  });

  it('returns null passPercent before any case completes', () => {
    expect(groupProgress(group()).passPercent).toBeNull();
  });
});

describe('patchGroupWithResult', () => {
  it('appends a failing result and recomputes counts', () => {
    const run = patchGroupWithResult(group(), arrived({ evaluations: [FAIL] })).runs[0];
    expect(run.results).toHaveLength(1);
    expect(run.failedCases).toBe(1);
    expect(run.passRate).toBe(0);
  });

  it('is idempotent for an already-present result', () => {
    const once = patchGroupWithResult(group(), arrived());
    const twice = patchGroupWithResult(once, arrived());
    expect(twice.runs[0].results).toHaveLength(1);
  });

  it('ignores events for another group', () => {
    const g = group();
    expect(patchGroupWithResult(g, arrived({ groupId: 'other' }))).toBe(g);
  });
});

describe('applyRunComplete / applyGroupComplete', () => {
  it('flips a run status', () => {
    const e: RunCompleteEvent = { type: 'run-complete', runId: 'run1', groupId: 'g1', status: TestRunStatus.Completed, completedAt: '2026-06-04T00:00:00Z' };
    expect(applyRunComplete(group(), e).runs[0].status).toBe(TestRunStatus.Completed);
  });

  it('flips the group status', () => {
    const e: GroupRunCompleteEvent = { type: 'group-run-complete', runId: 'run1', groupId: 'g1', groupStatus: TestRunStatus.Completed, groupCompletedAt: '2026-06-04T00:00:00Z' };
    expect(applyGroupComplete(group(), e).status).toBe(TestRunStatus.Completed);
  });
});
