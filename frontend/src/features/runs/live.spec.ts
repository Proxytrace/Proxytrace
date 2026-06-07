import { describe, it, expect } from 'vitest';
import { EvaluationScore, EvaluatorKind, TestRunStatus } from '../../api/models';
import type { EvaluationResultDto, TestRunEvent } from '../../api/models';
import { reduceLiveProgress, emptyLiveProgress, liveKey, liveCaseFor } from './live';

function evaluation(over: Partial<EvaluationResultDto> = {}): EvaluationResultDto {
  return {
    evaluatorId: 'ev1',
    evaluatorKind: EvaluatorKind.ExactMatch,
    evaluatorName: 'Exact',
    score: EvaluationScore.Good,
    reasoning: null,
    errorMessage: null,
    ...over,
  };
}

const started: TestRunEvent = { type: 'test-case-started', runId: 'run1', groupId: 'g1', testCaseId: 'c1' };
const inference: TestRunEvent = { type: 'inference-done', runId: 'run1', groupId: 'g1', testCaseId: 'c1' };
const evalArrived = (evalOver: Partial<EvaluationResultDto> = {}): TestRunEvent => ({
  type: 'evaluation-arrived', runId: 'run1', groupId: 'g1', testCaseId: 'c1', evaluation: evaluation(evalOver),
});

describe('reduceLiveProgress', () => {
  it('seeds an in-flight case on test-case-started', () => {
    const s = reduceLiveProgress(emptyLiveProgress(), started);
    const c = liveCaseFor(s, 'run1', 'c1');
    expect(c).toMatchObject({ runId: 'run1', testCaseId: 'c1', evaluations: [], inferenceDone: false });
  });

  it('is a no-op (same reference) when the case is already started', () => {
    const s = reduceLiveProgress(emptyLiveProgress(), started);
    expect(reduceLiveProgress(s, started)).toBe(s);
  });

  it('marks inference done, creating the case if started was missed', () => {
    const fromEmpty = reduceLiveProgress(emptyLiveProgress(), inference);
    expect(liveCaseFor(fromEmpty, 'run1', 'c1')?.inferenceDone).toBe(true);
  });

  it('accumulates evaluations per evaluator as they arrive', () => {
    let s = reduceLiveProgress(emptyLiveProgress(), started);
    s = reduceLiveProgress(s, inference);
    s = reduceLiveProgress(s, evalArrived({ evaluatorId: 'ev1', score: EvaluationScore.Good }));
    s = reduceLiveProgress(s, evalArrived({ evaluatorId: 'ev2', score: EvaluationScore.Bad }));
    expect(liveCaseFor(s, 'run1', 'c1')?.evaluations).toHaveLength(2);
  });

  it('replaces a re-reported evaluator rather than duplicating it', () => {
    let s = reduceLiveProgress(emptyLiveProgress(), evalArrived({ evaluatorId: 'ev1', score: EvaluationScore.Bad }));
    s = reduceLiveProgress(s, evalArrived({ evaluatorId: 'ev1', score: EvaluationScore.Good }));
    const evals = liveCaseFor(s, 'run1', 'c1')?.evaluations ?? [];
    expect(evals).toHaveLength(1);
    expect(evals[0].score).toBe(EvaluationScore.Good);
  });

  it('removes the case on test-result-arrived (now finalized in the cache)', () => {
    let s = reduceLiveProgress(emptyLiveProgress(), started);
    s = reduceLiveProgress(s, evalArrived());
    s = reduceLiveProgress(s, {
      type: 'test-result-arrived', runId: 'run1', groupId: 'g1', testCaseId: 'c1',
      overallScore: EvaluationScore.Good, evaluations: [evaluation()], durationMs: 100,
    });
    expect(liveCaseFor(s, 'run1', 'c1')).toBeUndefined();
  });

  it('drops a run’s lingering cases on run-complete', () => {
    let s = reduceLiveProgress(emptyLiveProgress(), started);
    s = reduceLiveProgress(s, { type: 'test-case-started', runId: 'run2', groupId: 'g1', testCaseId: 'c9' });
    s = reduceLiveProgress(s, { type: 'run-complete', runId: 'run1', groupId: 'g1', status: TestRunStatus.Completed, completedAt: null });
    expect(liveCaseFor(s, 'run1', 'c1')).toBeUndefined();
    expect(liveCaseFor(s, 'run2', 'c9')).toBeDefined();
  });

  it('clears everything on group-run-complete', () => {
    const s = reduceLiveProgress(emptyLiveProgress(), started);
    const done = reduceLiveProgress(s, { type: 'group-run-complete', runId: '', groupId: 'g1', groupStatus: TestRunStatus.Completed, groupCompletedAt: null });
    expect(done.size).toBe(0);
  });

  it('exposes a stable key for (run, case)', () => {
    expect(liveKey('r', 'c')).toBe('r:c');
  });
});
