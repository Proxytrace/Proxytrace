import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestRunStatus, TheoryStatus } from '../../../api/models';

const { testRunGroupsApi, theoriesApi } = vi.hoisted(() => ({
  testRunGroupsApi: { get: vi.fn() },
  theoriesApi: { get: vi.fn() },
}));
vi.mock('../../../api/test-run-groups', () => ({ testRunGroupsApi }));
vi.mock('../../../api/theories', () => ({ theoriesApi }));

import { createAwaitTools, isRunTerminal, isTheoryTerminal } from './await';
import type { TraceyToolContext } from './shared';

const ctx: TraceyToolContext = {
  projectId: 'p1', artifactScope: 'u:p', navigate: vi.fn(), confirm: vi.fn(),
};
const store = vi.fn();

describe('terminal predicates', () => {
  it('treats Completed/Failed/Cancelled runs as terminal, Running/Pending as not', () => {
    expect(isRunTerminal(TestRunStatus.Completed)).toBe(true);
    expect(isRunTerminal(TestRunStatus.Failed)).toBe(true);
    expect(isRunTerminal(TestRunStatus.Cancelled)).toBe(true);
    expect(isRunTerminal(TestRunStatus.Running)).toBe(false);
    expect(isRunTerminal(TestRunStatus.Pending)).toBe(false);
  });

  it('treats Validated/Invalidated theories as terminal, Proposed/Validating as not', () => {
    expect(isTheoryTerminal(TheoryStatus.Validated)).toBe(true);
    expect(isTheoryTerminal(TheoryStatus.Invalidated)).toBe(true);
    expect(isTheoryTerminal(TheoryStatus.Proposed)).toBe(false);
    expect(isTheoryTerminal(TheoryStatus.Validating)).toBe(false);
  });
});

describe('await_actions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('aggregates a mixed batch of already-terminal handles', async () => {
    testRunGroupsApi.get.mockResolvedValue({
      id: 'g1', suiteName: 'Suite', agentName: 'A', status: TestRunStatus.Completed,
      runs: [{ agentName: 'A', status: TestRunStatus.Completed, passedCases: 7, failedCases: 3, totalCases: 10, passRate: 70 }],
    });
    theoriesApi.get.mockResolvedValue({
      id: 't1', agentName: 'A', status: TheoryStatus.Validated, resultingProposalId: 'pr1',
    });

    const tool = createAwaitTools(ctx, store).await_actions;
    const result = await tool.execute!(
      { handles: [{ kind: 'test-run', id: 'g1' }, { kind: 'theory', id: 't1' }] },
      ctx,
    ) as { anyTimedOut: boolean; results: { kind: string; id: string; status: string; timedOut: boolean }[] };

    expect(result.anyTimedOut).toBe(false);
    expect(result.results).toHaveLength(2);
    expect(result.results[0]).toMatchObject({ kind: 'test-run', id: 'g1', status: TestRunStatus.Completed, timedOut: false });
    expect(result.results[1]).toMatchObject({ kind: 'theory', id: 't1', status: TheoryStatus.Validated, timedOut: false });
    expect(testRunGroupsApi.get).toHaveBeenCalledWith('g1');
    expect(theoriesApi.get).toHaveBeenCalledWith('t1');
  });
});
