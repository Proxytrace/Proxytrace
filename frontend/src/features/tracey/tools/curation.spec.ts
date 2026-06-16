import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestRunStatus } from '../../../api/models';

const { agentsApi, testSuitesApi, testCasesApi, testRunGroupsApi } = vi.hoisted(() => ({
  agentsApi: { get: vi.fn() },
  testSuitesApi: { get: vi.fn(), create: vi.fn(), addTestCase: vi.fn(), removeTestCase: vi.fn() },
  testCasesApi: { update: vi.fn() },
  testRunGroupsApi: { get: vi.fn(), cancel: vi.fn() },
}));
vi.mock('../../../api/agents', () => ({ agentsApi }));
vi.mock('../../../api/test-suites', () => ({ testSuitesApi }));
vi.mock('../../../api/test-cases', () => ({ testCasesApi }));
vi.mock('../../../api/test-run-groups', () => ({ testRunGroupsApi }));

import { createSuiteTools } from './suites';
import { createRunTools } from './runs';
import { CANCELLED } from './shared';
import type { TraceyToolContext } from './shared';

// store echoes the digest back so the returned result is assertable.
const store = vi.fn((_kind: string, _full: unknown, summary: unknown) => summary);

function makeCtx(confirmValue = true): TraceyToolContext {
  return {
    projectId: 'p1',
    artifactScope: 'u:p',
    navigate: vi.fn(),
    confirm: vi.fn().mockResolvedValue(confirmValue),
    loadedSkillIds: new Set<string>(),
  };
}

const suite = (over: Record<string, unknown> = {}) => ({
  id: 's1', name: 'My suite', agentName: 'A', testCases: [{ id: 'c1' }, { id: 'c2' }], passRate: 50, ...over,
});

beforeEach(() => vi.clearAllMocks());

describe('create_suite', () => {
  it('confirms, creates from traces, and returns a compact digest', async () => {
    const ctx = makeCtx();
    agentsApi.get.mockResolvedValue({ id: 'a1', name: 'A' });
    testSuitesApi.create.mockResolvedValue(suite({ testCases: [{ id: 'c1' }] }));

    const tool = createSuiteTools(ctx, store).create_suite;
    const result = await tool.execute!(
      { name: 'My suite', agentId: 'a1', agentCallIds: ['call1'] }, ctx,
    );

    expect(ctx.confirm).toHaveBeenCalledOnce();
    expect(testSuitesApi.create).toHaveBeenCalledWith({ name: 'My suite', agentId: 'a1', agentCallIds: ['call1'] });
    expect(result).toMatchObject({ id: 's1', name: 'My suite', caseCount: 1 });
  });

  it('returns notFound for a missing agent and never creates', async () => {
    const ctx = makeCtx();
    agentsApi.get.mockResolvedValue(null);
    const tool = createSuiteTools(ctx, store).create_suite;
    const result = await tool.execute!({ name: 'x', agentId: 'bad', agentCallIds: ['c'] }, ctx);
    expect(result).toEqual({ notFound: 'bad' });
    expect(testSuitesApi.create).not.toHaveBeenCalled();
  });

  it('returns CANCELLED on decline and never creates', async () => {
    const ctx = makeCtx(false);
    agentsApi.get.mockResolvedValue({ id: 'a1', name: 'A' });
    const tool = createSuiteTools(ctx, store).create_suite;
    const result = await tool.execute!({ name: 'x', agentId: 'a1', agentCallIds: ['c'] }, ctx);
    expect(result).toBe(CANCELLED);
    expect(testSuitesApi.create).not.toHaveBeenCalled();
  });
});

describe('add_to_suite', () => {
  it('adds each trace as a case and returns the final suite digest', async () => {
    const ctx = makeCtx();
    testSuitesApi.get.mockResolvedValue(suite());
    testSuitesApi.addTestCase
      .mockResolvedValueOnce(suite({ testCases: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }] }))
      .mockResolvedValueOnce(suite({ testCases: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }, { id: 'c4' }] }));

    const tool = createSuiteTools(ctx, store).add_to_suite;
    const result = await tool.execute!({ suiteId: 's1', agentCallIds: ['call3', 'call4'] }, ctx);

    expect(testSuitesApi.addTestCase).toHaveBeenCalledTimes(2);
    expect(testSuitesApi.addTestCase).toHaveBeenNthCalledWith(1, 's1', 'call3');
    expect(testSuitesApi.addTestCase).toHaveBeenNthCalledWith(2, 's1', 'call4');
    expect(result).toMatchObject({ id: 's1', caseCount: 4 });
  });

  it('returns notFound for a missing suite and never adds', async () => {
    const ctx = makeCtx();
    testSuitesApi.get.mockResolvedValue(null);
    const tool = createSuiteTools(ctx, store).add_to_suite;
    const result = await tool.execute!({ suiteId: 'bad', agentCallIds: ['c'] }, ctx);
    expect(result).toEqual({ notFound: 'bad' });
    expect(testSuitesApi.addTestCase).not.toHaveBeenCalled();
  });

  it('captures a per-id failure without losing the cases that did add', async () => {
    const ctx = makeCtx();
    testSuitesApi.get.mockResolvedValue(suite());
    testSuitesApi.addTestCase
      .mockResolvedValueOnce(suite({ testCases: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }] }))
      .mockRejectedValueOnce(new Error('stale trace'));

    const tool = createSuiteTools(ctx, store).add_to_suite;
    const result = await tool.execute!({ suiteId: 's1', agentCallIds: ['good', 'bad'] }, ctx) as {
      caseCount: number; failed?: { id: string; error: string }[];
    };

    expect(testSuitesApi.addTestCase).toHaveBeenCalledTimes(2);
    expect(result.caseCount).toBe(3); // the successful add is still reflected
    expect(result.failed).toEqual([{ id: 'bad', error: 'stale trace' }]);
  });
});

describe('remove_test_case', () => {
  it('confirms and removes the case, returning the updated suite digest', async () => {
    const ctx = makeCtx();
    testSuitesApi.get.mockResolvedValue(suite());
    testSuitesApi.removeTestCase.mockResolvedValue(suite({ testCases: [{ id: 'c1' }] }));

    const tool = createSuiteTools(ctx, store).remove_test_case;
    const result = await tool.execute!({ suiteId: 's1', caseId: 'c2' }, ctx);

    expect(testSuitesApi.removeTestCase).toHaveBeenCalledWith('s1', 'c2');
    expect(result).toMatchObject({ id: 's1', caseCount: 1 });
  });
});

describe('update_expected_output', () => {
  it('updates the case with an assistant message and reports updated', async () => {
    const ctx = makeCtx();
    testCasesApi.update.mockResolvedValue({ id: 'c1' });
    const tool = createSuiteTools(ctx, store).update_expected_output;
    const result = await tool.execute!({ caseId: 'c1', content: 'the right answer' }, ctx);

    expect(testCasesApi.update).toHaveBeenCalledWith(
      'c1', { role: 'assistant', content: 'the right answer' }, { silentStatuses: [404] },
    );
    expect(result).toEqual({ caseId: 'c1', status: 'updated' });
  });

  it('returns notFound when the case is gone', async () => {
    const ctx = makeCtx();
    const err = Object.assign(new Error('404'), { status: 404 });
    testCasesApi.update.mockRejectedValue(err);
    const tool = createSuiteTools(ctx, store).update_expected_output;
    const result = await tool.execute!({ caseId: 'gone', content: 'x' }, ctx);
    expect(result).toEqual({ notFound: 'gone' });
  });

  it('returns CANCELLED on decline and never updates', async () => {
    const ctx = makeCtx(false);
    const tool = createSuiteTools(ctx, store).update_expected_output;
    const result = await tool.execute!({ caseId: 'c1', content: 'x' }, ctx);
    expect(result).toBe(CANCELLED);
    expect(testCasesApi.update).not.toHaveBeenCalled();
  });
});

describe('cancel_test_run', () => {
  it('confirms and cancels the group, returning its status', async () => {
    const ctx = makeCtx();
    testRunGroupsApi.get.mockResolvedValue({ id: 'g1', suiteName: 'S', agentName: 'A', status: TestRunStatus.Running });
    testRunGroupsApi.cancel.mockResolvedValue({ id: 'g1', status: TestRunStatus.Cancelled });

    const tool = createRunTools(ctx, store).cancel_test_run;
    const result = await tool.execute!({ groupId: 'g1' }, ctx);

    expect(testRunGroupsApi.cancel).toHaveBeenCalledWith('g1');
    expect(result).toEqual({ id: 'g1', status: TestRunStatus.Cancelled });
  });

  it('short-circuits a finished run without calling cancel', async () => {
    const ctx = makeCtx();
    testRunGroupsApi.get.mockResolvedValue({ id: 'g1', suiteName: 'S', agentName: 'A', status: TestRunStatus.Completed });
    const tool = createRunTools(ctx, store).cancel_test_run;
    const result = await tool.execute!({ groupId: 'g1' }, ctx);
    expect(result).toEqual({ id: 'g1', status: TestRunStatus.Completed, alreadyTerminal: true });
    expect(ctx.confirm).not.toHaveBeenCalled();
    expect(testRunGroupsApi.cancel).not.toHaveBeenCalled();
  });

  it('returns notFound for a missing group and never cancels', async () => {
    const ctx = makeCtx();
    testRunGroupsApi.get.mockResolvedValue(null);
    const tool = createRunTools(ctx, store).cancel_test_run;
    const result = await tool.execute!({ groupId: 'bad' }, ctx);
    expect(result).toEqual({ notFound: 'bad' });
    expect(testRunGroupsApi.cancel).not.toHaveBeenCalled();
  });

  it('returns CANCELLED on decline and never cancels', async () => {
    const ctx = makeCtx(false);
    testRunGroupsApi.get.mockResolvedValue({ id: 'g1', suiteName: 'S', agentName: 'A', status: TestRunStatus.Running });
    const tool = createRunTools(ctx, store).cancel_test_run;
    const result = await tool.execute!({ groupId: 'g1' }, ctx);
    expect(result).toBe(CANCELLED);
    expect(testRunGroupsApi.cancel).not.toHaveBeenCalled();
  });
});
