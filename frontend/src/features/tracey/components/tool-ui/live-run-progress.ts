// Pure derive/fold helpers for Tracey's live test-run progress card. No JSX, no I/O —
// unit-tested in live-run-progress.spec.ts. Each fold returns a new group (referentially
// changed only when it actually applies) so the card can patch the query cache in place as
// SSE events arrive, never refetching (BEST_PRACTICES §3.2). The single-group analog of
// `patchGroupsWithResult` in features/runs/results.ts.

import type {
  GroupRunCompleteEvent,
  RunCompleteEvent,
  TestResultArrivedEvent,
  TestResultDto,
  TestRunGroupDto,
} from '../../../../api/models';
import { compositePercent, resultPass } from '../../../../lib/runResults';

export interface RunProgress {
  /** Total cases across every run in the group (cases × endpoints). */
  total: number;
  /** Cases that have produced a result so far. */
  completed: number;
  passed: number;
  failed: number;
  /** Completion on a 0..100 scale. */
  percent: number;
  /** Pass rate of the *completed* cases on a 0..100 scale; `null` until one completes. */
  passPercent: number | null;
}

/** Rolls a group's runs up into the counts the live card displays. */
export function groupProgress(group: TestRunGroupDto): RunProgress {
  const total = group.runs.reduce((sum, run) => sum + run.totalCases, 0);
  let completed = 0;
  let passed = 0;
  let failed = 0;
  for (const run of group.runs) {
    completed += run.results.length;
    for (const result of run.results) {
      const pass = resultPass(result);
      if (pass === true) passed += 1;
      else if (pass === false) failed += 1;
    }
  }
  return {
    total,
    completed,
    passed,
    failed,
    percent: compositePercent(completed, total) ?? 0,
    passPercent: compositePercent(passed, passed + failed),
  };
}

/**
 * Folds a `test-result-arrived` event into a single group: appends the arriving result to its
 * run and recomputes that run's pass/fail counts. Returns the group unchanged if the event is
 * for another group/run or the result is already present (idempotent).
 */
export function patchGroupWithResult(group: TestRunGroupDto, e: TestResultArrivedEvent): TestRunGroupDto {
  if (group.id !== e.groupId) return group;
  return {
    ...group,
    runs: group.runs.map((run) => {
      if (run.id !== e.runId || run.results.some((r) => r.testCaseId === e.testCaseId)) return run;
      const result: TestResultDto = {
        id: e.testCaseId,
        testCaseId: e.testCaseId,
        testCaseSummary: run.testCases.find((tc) => tc.id === e.testCaseId)?.summary ?? '',
        actualResponse: '',
        evaluations: e.evaluations,
        durationMs: e.durationMs,
      };
      const results = [...run.results, result];
      const passedCases = results.filter((r) => resultPass(r) === true).length;
      const failedCases = results.filter((r) => resultPass(r) === false).length;
      return { ...run, results, passedCases, failedCases, passRate: compositePercent(passedCases, run.totalCases) ?? 0 };
    }),
  };
}

/** Applies a per-run `run-complete` event, flipping that run's status + completion time. */
export function applyRunComplete(group: TestRunGroupDto, e: RunCompleteEvent): TestRunGroupDto {
  if (group.id !== e.groupId) return group;
  return {
    ...group,
    runs: group.runs.map((run) => (run.id === e.runId ? { ...run, status: e.status, completedAt: e.completedAt } : run)),
  };
}

/** Applies the terminal `group-run-complete` event, flipping the whole group's status. */
export function applyGroupComplete(group: TestRunGroupDto, e: GroupRunCompleteEvent): TestRunGroupDto {
  if (group.id !== e.groupId) return group;
  return { ...group, status: e.groupStatus, completedAt: e.groupCompletedAt };
}
