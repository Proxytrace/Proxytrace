import { z } from 'zod';
import { testRunGroupsApi } from '../../../api/test-run-groups';
import { theoriesApi } from '../../../api/theories';
import { TestRunStatus, TheoryStatus, type TestRunGroupDto, type TheoryDto } from '../../../api/models';
import { type ToolFactory, tool } from './shared';
import { pollUntilTerminal, type PollOptions } from './poll-until-terminal';

/** How often a pending action is polled while waiting. */
const POLL_INTERVAL_MS = 3_000;
/** Hard cap on a single wait. Generous for real suites; a slow action returns `timedOut: true`. */
const AWAIT_ACTIONS_TIMEOUT_MS = 10 * 60 * 1_000;

const TERMINAL_RUN: ReadonlySet<TestRunStatus> = new Set([
  TestRunStatus.Completed,
  TestRunStatus.Failed,
  TestRunStatus.Cancelled,
]);
const TERMINAL_THEORY: ReadonlySet<TheoryStatus> = new Set([
  TheoryStatus.Validated,
  TheoryStatus.Invalidated,
]);

export const isRunTerminal = (status: TestRunStatus): boolean => TERMINAL_RUN.has(status);
export const isTheoryTerminal = (status: TheoryStatus): boolean => TERMINAL_THEORY.has(status);

/** The kinds of long-running action Tracey can wait on. */
export type AwaitKind = 'test-run' | 'theory';

/** Compact, model-facing result for one awaited handle. */
export interface AwaitResult {
  kind: AwaitKind;
  id: string;
  status: TestRunStatus | TheoryStatus;
  timedOut: boolean;
}

interface RunAwaitResult extends AwaitResult {
  kind: 'test-run';
  status: TestRunStatus;
  suiteName: string;
  agentName: string;
  runs: { agentName: string; status: TestRunStatus; passed: number; failed: number; total: number; passRate: number }[];
}

interface TheoryAwaitResult extends AwaitResult {
  kind: 'theory';
  status: TheoryStatus;
  agentName: string;
  resultingProposalId: string | null;
}

function summarizeRun(group: TestRunGroupDto, timedOut: boolean): RunAwaitResult {
  return {
    kind: 'test-run',
    id: group.id,
    status: group.status,
    timedOut,
    suiteName: group.suiteName,
    agentName: group.agentName,
    runs: group.runs.map((run) => ({
      agentName: run.agentName,
      status: run.status,
      passed: run.passedCases,
      failed: run.failedCases,
      total: run.totalCases,
      passRate: run.passRate,
    })),
  };
}

function summarizeTheory(theory: TheoryDto, timedOut: boolean): TheoryAwaitResult {
  return {
    kind: 'theory',
    id: theory.id,
    status: theory.status,
    timedOut,
    agentName: theory.agentName,
    resultingProposalId: theory.resultingProposalId,
  };
}

/** Waits on a single handle, dispatching to the right API + terminal predicate by kind. */
async function awaitOne(handle: { kind: AwaitKind; id: string }, opts: PollOptions): Promise<AwaitResult> {
  if (handle.kind === 'test-run') {
    const { snapshot, timedOut } = await pollUntilTerminal(
      () => testRunGroupsApi.get(handle.id),
      (g) => isRunTerminal(g.status),
      opts,
    );
    return summarizeRun(snapshot, timedOut);
  }
  const { snapshot, timedOut } = await pollUntilTerminal(
    () => theoriesApi.get(handle.id),
    (t) => isTheoryTerminal(t.status),
    opts,
  );
  return summarizeTheory(snapshot, timedOut);
}

const handleSchema = z.object({
  kind: z.enum(['test-run', 'theory']).describe('The kind of action: "test-run" or "theory".'),
  id: z.string().describe('The action id from the `awaitable` handle of the producing tool.'),
});

/**
 * Tracey's wait tool. Resolves once every handed-in action reaches a terminal state (or the
 * per-handle cap is hit), then returns one aggregate so Tracey can react in the same turn.
 */
export const createAwaitTools: ToolFactory = () => ({
  await_actions: tool({
    description:
      'Wait for one or more long-running actions to finish, then return their results so you can ' +
      'react in the same turn. Pass the `awaitable` handle returned by start_test_run or ' +
      'submit_optimization_theory. Start ALL the actions first, then call this ONCE with every ' +
      'handle — do not call it per action and do not poll yourself.',
    parameters: z.object({
      handles: z.array(handleSchema).min(1).describe('The actions to wait for.'),
    }),
    confirm: false,
    execute: async ({ handles }) => {
      const opts: PollOptions = {
        intervalMs: POLL_INTERVAL_MS,
        timeoutMs: AWAIT_ACTIONS_TIMEOUT_MS,
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        now: () => Date.now(),
      };
      const results = await Promise.all(handles.map((handle) => awaitOne(handle, opts)));
      return { results, anyTimedOut: results.some((r) => r.timedOut) };
    },
  }),
});
