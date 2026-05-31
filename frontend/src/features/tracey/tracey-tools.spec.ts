import { describe, it, expect, vi, beforeEach } from 'vitest';

const { agentsApi, testSuitesApi, testRunsApi, testRunGroupsApi, proposalsApi, statisticsApi } = vi.hoisted(() => ({
  agentsApi: { list: vi.fn(), get: vi.fn() },
  testSuitesApi: { list: vi.fn(), get: vi.fn() },
  testRunsApi: { list: vi.fn(), get: vi.fn() },
  testRunGroupsApi: { create: vi.fn() },
  proposalsApi: { getAll: vi.fn(), updateStatus: vi.fn() },
  statisticsApi: { dashboard: vi.fn(), agentOverview: vi.fn() },
}));

vi.mock('../../api/agents', () => ({ agentsApi }));
vi.mock('../../api/test-suites', () => ({ testSuitesApi }));
vi.mock('../../api/test-runs', () => ({ testRunsApi }));
vi.mock('../../api/test-run-groups', () => ({ testRunGroupsApi }));
vi.mock('../../api/proposals', () => ({ proposalsApi }));
vi.mock('../../api/statistics', () => ({ statisticsApi }));

import { createTraceyTools, CANCELLED, type TraceyToolContext } from './tracey-tools';
import { ProposalStatus } from '../../api/models';

function makeCtx(overrides: Partial<TraceyToolContext> = {}): TraceyToolContext {
  return {
    projectId: 'proj-1',
    navigate: vi.fn(),
    confirm: vi.fn().mockResolvedValue(true),
    showArtifact: vi.fn(),
    ...overrides,
  };
}

describe('tracey read tools', () => {
  beforeEach(() => vi.clearAllMocks());

  it('list_agents passes the project id and returns the items', async () => {
    agentsApi.list.mockResolvedValue({ items: [{ id: 'a1' }] });
    const ctx = makeCtx();
    const result = await createTraceyTools(ctx).list_agents.execute({}, ctx);

    expect(agentsApi.list).toHaveBeenCalledWith({ projectId: 'proj-1' });
    expect(result).toEqual([{ id: 'a1' }]);
  });

  it('get_agent fetches by id', async () => {
    agentsApi.get.mockResolvedValue({ id: 'a1', name: 'A' });
    const ctx = makeCtx();
    await createTraceyTools(ctx).get_agent.execute({ agentId: 'a1' }, ctx);

    expect(agentsApi.get).toHaveBeenCalledWith('a1');
  });

  it('get_agent_stats fetches the agent overview and returns summary + counts', async () => {
    statisticsApi.agentOverview.mockResolvedValue({
      summary: { totalTraces: 3 },
      counts: { suiteCount: 1 },
      timeSeries: [],
    });
    const ctx = makeCtx();
    const result = await createTraceyTools(ctx).get_agent_stats.execute({ agentId: 'a1' }, ctx);

    expect(statisticsApi.agentOverview).toHaveBeenCalledWith(
      'a1',
      expect.objectContaining({ bucket: 'daily' }),
    );
    expect(result).toEqual({ summary: { totalTraces: 3 }, counts: { suiteCount: 1 } });
  });

  it('navigate performs a client-side route change', async () => {
    const ctx = makeCtx();
    await createTraceyTools(ctx).navigate.execute({ path: '/agents' }, ctx);

    expect(ctx.navigate).toHaveBeenCalledWith('/agents');
  });
});

describe('tracey write tools confirmation gating', () => {
  beforeEach(() => vi.clearAllMocks());

  it('start_test_run fires the run when confirmed', async () => {
    agentsApi.get.mockResolvedValue({ id: 'a1', name: 'A', endpointId: 'e1', endpointName: 'gpt' });
    testSuitesApi.get.mockResolvedValue({ id: 's1', name: 'Suite' });
    testRunGroupsApi.create.mockResolvedValue({ id: 'g1' });
    const ctx = makeCtx({ confirm: vi.fn().mockResolvedValue(true) });

    const result = await createTraceyTools(ctx).start_test_run.execute({ suiteId: 's1', agentId: 'a1' }, ctx);

    expect(ctx.confirm).toHaveBeenCalledOnce();
    expect(testRunGroupsApi.create).toHaveBeenCalledWith('s1', ['e1']);
    expect(result).toEqual({ id: 'g1' });
  });

  it('start_test_run cancels without calling the API when declined', async () => {
    agentsApi.get.mockResolvedValue({ id: 'a1', name: 'A', endpointId: 'e1', endpointName: 'gpt' });
    testSuitesApi.get.mockResolvedValue({ id: 's1', name: 'Suite' });
    const ctx = makeCtx({ confirm: vi.fn().mockResolvedValue(false) });

    const result = await createTraceyTools(ctx).start_test_run.execute({ suiteId: 's1', agentId: 'a1' }, ctx);

    expect(testRunGroupsApi.create).not.toHaveBeenCalled();
    expect(result).toBe(CANCELLED);
  });

  it('set_proposal_status updates when confirmed', async () => {
    proposalsApi.updateStatus.mockResolvedValue({ id: 'p1', status: ProposalStatus.Accepted });
    const ctx = makeCtx({ confirm: vi.fn().mockResolvedValue(true) });

    await createTraceyTools(ctx).set_proposal_status.execute(
      { proposalId: 'p1', status: ProposalStatus.Accepted },
      ctx,
    );

    expect(proposalsApi.updateStatus).toHaveBeenCalledWith('p1', ProposalStatus.Accepted);
  });

  it('set_proposal_status is a no-op when declined', async () => {
    const ctx = makeCtx({ confirm: vi.fn().mockResolvedValue(false) });

    const result = await createTraceyTools(ctx).set_proposal_status.execute(
      { proposalId: 'p1', status: ProposalStatus.Rejected },
      ctx,
    );

    expect(proposalsApi.updateStatus).not.toHaveBeenCalled();
    expect(result).toBe(CANCELLED);
  });
});

describe('tracey artifact tools', () => {
  beforeEach(() => vi.clearAllMocks());

  it('show_chart pushes a chart artifact', async () => {
    const showArtifact = vi.fn();
    const ctx = makeCtx({ showArtifact });
    const points = [{ label: 'A', value: 1 }, { label: 'B', value: 2 }];

    const result = await createTraceyTools(ctx).show_chart.execute(
      { title: 'Tokens', type: 'bar', points },
      ctx,
    );

    expect(showArtifact).toHaveBeenCalledWith({ kind: 'chart', title: 'Tokens', chartType: 'bar', points });
    expect(result).toEqual({ shown: true, title: 'Tokens' });
  });

  it('show_table pushes a table artifact', async () => {
    const showArtifact = vi.fn();
    const ctx = makeCtx({ showArtifact });

    await createTraceyTools(ctx).show_table.execute(
      { title: 'Agents', columns: ['name'], rows: [['A']] },
      ctx,
    );

    expect(showArtifact).toHaveBeenCalledWith({
      kind: 'table',
      title: 'Agents',
      columns: ['name'],
      rows: [['A']],
    });
  });

  it('show_text pushes a text artifact', async () => {
    const showArtifact = vi.fn();
    const ctx = makeCtx({ showArtifact });

    await createTraceyTools(ctx).show_text.execute(
      { title: 'Notes', format: 'markdown', content: 'hi' },
      ctx,
    );

    expect(showArtifact).toHaveBeenCalledWith({
      kind: 'text',
      title: 'Notes',
      format: 'markdown',
      content: 'hi',
    });
  });
});
