// Ephemeral, client-side live progress for an in-flight test-run group. Pure fold of the
// SSE run events into a per-(run, case) map that records which evaluators have reported so
// far — this is what makes per-evaluator progress visible *during* a run. Finalized results
// live in the query cache (see results.ts `patchGroupsWithResult`); this map only holds the
// in-flight cases and is discarded as each case completes. No JSX, no I/O — unit-tested in
// live.spec.ts.

import type { EvaluationResultDto, TestRunEvent } from '../../api/models';

/** In-flight progress for one (run, case) pair: the evaluations reported so far. */
export interface LiveCase {
  runId: string;
  testCaseId: string;
  /** Evaluations that have arrived so far (deduped by evaluator), oldest discarded on replace. */
  evaluations: EvaluationResultDto[];
  /** True once inference finished and evaluators are running. */
  inferenceDone: boolean;
}

/** Keyed by {@link liveKey}. Treated as immutable: each fold returns a new map when it changes. */
export type LiveProgress = ReadonlyMap<string, LiveCase>;

export const liveKey = (runId: string, testCaseId: string): string => `${runId}:${testCaseId}`;

export const emptyLiveProgress = (): LiveProgress => new Map();

/** Looks up a case's live progress, scoping by run so multi-model groups don't collide. */
export const liveCaseFor = (live: LiveProgress | undefined, runId: string, testCaseId: string): LiveCase | undefined =>
  live?.get(liveKey(runId, testCaseId));

const seed = (runId: string, testCaseId: string, inferenceDone: boolean): LiveCase =>
  ({ runId, testCaseId, evaluations: [], inferenceDone });

/**
 * Folds one SSE run event into the live in-flight map. `test-result-arrived` removes the case
 * (it has just been finalized into the query cache); `run-complete` drops that run's lingering
 * cases and `group-run-complete` clears everything. Returns the same reference when nothing
 * changes so React can skip re-renders.
 */
export function reduceLiveProgress(state: LiveProgress, e: TestRunEvent): LiveProgress {
  switch (e.type) {
    case 'test-case-started': {
      const key = liveKey(e.runId, e.testCaseId);
      if (state.has(key)) return state;
      return new Map(state).set(key, seed(e.runId, e.testCaseId, false));
    }
    case 'inference-done': {
      const key = liveKey(e.runId, e.testCaseId);
      const cur = state.get(key) ?? seed(e.runId, e.testCaseId, false);
      return new Map(state).set(key, { ...cur, inferenceDone: true });
    }
    case 'evaluation-arrived': {
      const key = liveKey(e.runId, e.testCaseId);
      const cur = state.get(key) ?? seed(e.runId, e.testCaseId, true);
      const evaluations = [
        ...cur.evaluations.filter(x => x.evaluatorId !== e.evaluation.evaluatorId),
        e.evaluation,
      ];
      return new Map(state).set(key, { ...cur, evaluations });
    }
    case 'test-result-arrived': {
      const key = liveKey(e.runId, e.testCaseId);
      if (!state.has(key)) return state;
      const next = new Map(state);
      next.delete(key);
      return next;
    }
    case 'run-complete': {
      const next = new Map(state);
      let changed = false;
      for (const [k, v] of state) {
        if (v.runId === e.runId) {
          next.delete(k);
          changed = true;
        }
      }
      return changed ? next : state;
    }
    case 'group-run-complete':
      return state.size > 0 ? emptyLiveProgress() : state;
    default:
      return state;
  }
}
