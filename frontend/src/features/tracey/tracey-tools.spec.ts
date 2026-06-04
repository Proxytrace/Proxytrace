import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getArtifact } from './tracey-artifact-store';

const { agentsApi, testSuitesApi, testRunsApi, testRunGroupsApi, proposalsApi, providersApi, agentCallsApi, statisticsApi, theoriesApi } = vi.hoisted(() => ({
  agentsApi: { list: vi.fn(), get: vi.fn() },
  testSuitesApi: { list: vi.fn(), get: vi.fn() },
  testRunsApi: { list: vi.fn(), get: vi.fn() },
  testRunGroupsApi: { create: vi.fn() },
  proposalsApi: { getAll: vi.fn(), updateStatus: vi.fn() },
  providersApi: { get: vi.fn() },
  agentCallsApi: { get: vi.fn() },
  statisticsApi: { dashboard: vi.fn(), agentOverview: vi.fn() },
  theoriesApi: { submit: vi.fn(), get: vi.fn() },
}));

vi.mock('../../api/agents', () => ({ agentsApi }));
vi.mock('../../api/test-suites', () => ({ testSuitesApi }));
vi.mock('../../api/test-runs', () => ({ testRunsApi }));
vi.mock('../../api/test-run-groups', () => ({ testRunGroupsApi }));
vi.mock('../../api/proposals', () => ({ proposalsApi }));
vi.mock('../../api/providers', () => ({ providersApi }));
vi.mock('../../api/agent-calls', () => ({ agentCallsApi }));
vi.mock('../../api/statistics', () => ({ statisticsApi }));
vi.mock('../../api/theories', () => ({ theoriesApi }));

import { createTraceyTools, CANCELLED, type TraceyTool, type TraceyToolContext } from './tracey-tools';
import { Priority, ProposalStatus, TheorySource } from '../../api/models';

function makeCtx(overrides: Partial<TraceyToolContext> = {}): TraceyToolContext {
  return {
    projectId: 'proj-1',
    artifactScope: 'user-1:proj-1',
    navigate: vi.fn(),
    confirm: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

/** Invoke a tool's `execute`, asserting it exists (only interactive tools omit it). */
function exec(t: TraceyTool, args: Record<string, unknown>, ctx: TraceyToolContext) {
  if (!t.execute) throw new Error('tool has no execute');
  return t.execute(args, ctx);
}

describe('tracey read tools', () => {
  beforeEach(() => vi.clearAllMocks());

  it('list_agents stores the full list and returns a compact index envelope', async () => {
    const items = [{ id: 'a1', name: 'Alpha' }, { id: 'a2', name: 'Beta' }];
    agentsApi.list.mockResolvedValue({ items });
    const ctx = makeCtx();
    const result = await exec(createTraceyTools(ctx).list_agents, {}, ctx) as {
      artifactRef: string; kind: string; summary: { count: number; items: { id: string; name: string }[] };
    };

    expect(agentsApi.list).toHaveBeenCalledWith({ projectId: 'proj-1' });
    expect(result.kind).toBe('agent-list');
    expect(result.summary).toEqual({ count: 2, items: [{ id: 'a1', name: 'Alpha' }, { id: 'a2', name: 'Beta' }] });
    expect(await getArtifact(result.artifactRef)).toEqual(items);
  });

  it('falls back to the full payload inline when the artifact store is unavailable', async () => {
    const items = [{ id: 'a1', name: 'Alpha' }];
    agentsApi.list.mockResolvedValue({ items });
    const ctx = makeCtx();
    // Force storeArtifact to throw (simulating IndexedDB disabled, e.g. private browsing).
    const spy = vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
      throw new Error('store unavailable');
    });
    try {
      const result = await exec(createTraceyTools(ctx).list_agents, {}, ctx);
      expect(result).toEqual(items);
      expect(result).not.toHaveProperty('artifactRef');
    } finally {
      spy.mockRestore();
    }
  });

  it('get_agent stores the full agent and returns a curated summary', async () => {
    const agent = {
      id: 'a1', name: 'Alpha', endpointName: 'gpt-4o',
      tools: [{ name: 't1' }, { name: 't2' }], systemMessage: 'You are Alpha.',
    };
    agentsApi.get.mockResolvedValue(agent);
    const ctx = makeCtx();
    const result = await exec(createTraceyTools(ctx).get_agent, { agentId: 'a1' }, ctx) as {
      artifactRef: string; kind: string; summary: Record<string, unknown>;
    };

    expect(agentsApi.get).toHaveBeenCalledWith('a1');
    expect(result.kind).toBe('agent');
    expect(result.summary).toMatchObject({ id: 'a1', name: 'Alpha', endpointName: 'gpt-4o', toolCount: 2 });
    expect(await getArtifact(result.artifactRef)).toEqual(agent);
  });

  it('get_agent_stats stores summary + counts and returns the summary digest', async () => {
    statisticsApi.agentOverview.mockResolvedValue({
      summary: { totalTraces: 3 },
      counts: { suiteCount: 1 },
      timeSeries: [],
    });
    const ctx = makeCtx();
    const result = await exec(createTraceyTools(ctx).get_agent_stats, { agentId: 'a1' }, ctx) as {
      artifactRef: string; kind: string; summary: Record<string, unknown>;
    };

    expect(statisticsApi.agentOverview).toHaveBeenCalledWith(
      'a1',
      expect.objectContaining({ bucket: 'daily' }),
    );
    expect(result.kind).toBe('agent-stats');
    expect(result.summary).toEqual({ summary: { totalTraces: 3 } });
    expect(await getArtifact(result.artifactRef)).toEqual({ summary: { totalTraces: 3 }, counts: { suiteCount: 1 } });
  });

  it('navigate performs a client-side route change', async () => {
    const ctx = makeCtx();
    await exec(createTraceyTools(ctx).navigate, { path: '/agents' }, ctx);

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

    const result = await exec(createTraceyTools(ctx).start_test_run, { suiteId: 's1', agentId: 'a1' }, ctx);

    expect(ctx.confirm).toHaveBeenCalledOnce();
    expect(testRunGroupsApi.create).toHaveBeenCalledWith('s1', ['e1']);
    expect(result).toEqual({ id: 'g1' });
  });

  it('start_test_run cancels without calling the API when declined', async () => {
    agentsApi.get.mockResolvedValue({ id: 'a1', name: 'A', endpointId: 'e1', endpointName: 'gpt' });
    testSuitesApi.get.mockResolvedValue({ id: 's1', name: 'Suite' });
    const ctx = makeCtx({ confirm: vi.fn().mockResolvedValue(false) });

    const result = await exec(createTraceyTools(ctx).start_test_run, { suiteId: 's1', agentId: 'a1' }, ctx);

    expect(testRunGroupsApi.create).not.toHaveBeenCalled();
    expect(result).toBe(CANCELLED);
  });

  it('set_proposal_status updates when confirmed', async () => {
    proposalsApi.updateStatus.mockResolvedValue({ id: 'p1', status: ProposalStatus.Accepted });
    const ctx = makeCtx({ confirm: vi.fn().mockResolvedValue(true) });

    await exec(createTraceyTools(ctx).set_proposal_status, 
      { proposalId: 'p1', status: ProposalStatus.Accepted },
      ctx,
    );

    expect(proposalsApi.updateStatus).toHaveBeenCalledWith('p1', ProposalStatus.Accepted);
  });

  it('set_proposal_status is a no-op when declined', async () => {
    const ctx = makeCtx({ confirm: vi.fn().mockResolvedValue(false) });

    const result = await exec(createTraceyTools(ctx).set_proposal_status, 
      { proposalId: 'p1', status: ProposalStatus.Rejected },
      ctx,
    );

    expect(proposalsApi.updateStatus).not.toHaveBeenCalled();
    expect(result).toBe(CANCELLED);
  });
});

describe('tracey entity-fetch tools', () => {
  beforeEach(() => vi.clearAllMocks());

  it('get_provider fetches by id', async () => {
    providersApi.get.mockResolvedValue({ id: 'pr1', name: 'OpenAI' });
    const ctx = makeCtx();
    await exec(createTraceyTools(ctx).get_provider, { providerId: 'pr1' }, ctx);

    expect(providersApi.get).toHaveBeenCalledWith('pr1');
  });

  it('get_trace stores the full call and returns a curated summary', async () => {
    const call = { id: 't1', model: 'gpt-4o', provider: 'openai', httpStatus: 200, inputTokens: 10, outputTokens: 20, durationMs: 500, costEur: 0.1 };
    agentCallsApi.get.mockResolvedValue(call);
    const ctx = makeCtx();
    const result = await exec(createTraceyTools(ctx).get_trace, { traceId: 't1' }, ctx) as {
      artifactRef: string; kind: string; summary: Record<string, unknown>;
    };

    expect(agentCallsApi.get).toHaveBeenCalledWith('t1');
    expect(result.kind).toBe('trace');
    expect(result.summary).toMatchObject({ id: 't1', model: 'gpt-4o', httpStatus: 200 });
    expect(await getArtifact(result.artifactRef)).toEqual(call);
  });
});

describe('tracey inline render tools', () => {
  beforeEach(() => vi.clearAllMocks());

  it('show_chart stores the chart spec and returns a reference with a title-only summary', async () => {
    const ctx = makeCtx();
    const points = [{ label: 'A', value: 1 }, { label: 'B', value: 2 }];

    const result = await exec(createTraceyTools(ctx).show_chart,
      { title: 'Tokens', type: 'bar', points },
      ctx,
    ) as { artifactRef: string; kind: string; summary: Record<string, unknown> };

    expect(result.kind).toBe('chart');
    expect(result.summary).toEqual({ kind: 'chart', title: 'Tokens' });
    expect(await getArtifact(result.artifactRef))
      .toEqual({ kind: 'chart', title: 'Tokens', chartType: 'bar', points });
  });

  it('show_table stores the table spec and returns a reference', async () => {
    const ctx = makeCtx();

    const result = await exec(createTraceyTools(ctx).show_table,
      { title: 'Agents', columns: ['name'], rows: [['A']] },
      ctx,
    ) as { artifactRef: string; kind: string; summary: Record<string, unknown> };

    expect(result.kind).toBe('table');
    expect(result.summary).toEqual({ kind: 'table', title: 'Agents' });
    expect(await getArtifact(result.artifactRef))
      .toEqual({ kind: 'table', title: 'Agents', columns: ['name'], rows: [['A']] });
  });

  it('show_text stores the text spec and returns a reference', async () => {
    const ctx = makeCtx();

    const result = await exec(createTraceyTools(ctx).show_text,
      { title: 'Notes', format: 'markdown', content: 'hi' },
      ctx,
    ) as { artifactRef: string; kind: string; summary: Record<string, unknown> };

    expect(result.kind).toBe('text');
    expect(result.summary).toEqual({ kind: 'text', title: 'Notes' });
    expect(await getArtifact(result.artifactRef))
      .toEqual({ kind: 'text', title: 'Notes', format: 'markdown', content: 'hi' });
  });

  it('ask_questions is human-in-the-loop: no execute, so the tool call pauses for its UI', () => {
    const ctx = makeCtx();

    // No `execute` means the AI SDK emits the call and waits; the tool UI resolves it via addResult.
    expect(createTraceyTools(ctx).ask_questions.execute).toBeUndefined();
  });
});

describe('tracey load_skill tool', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the instructions for a known skill', async () => {
    const ctx = makeCtx();
    const result = await exec(createTraceyTools(ctx).load_skill, { skillId: 'optimize-agent' }, ctx) as {
      name: string; instructions: string;
    };

    expect(result.name).toBe('optimize-agent');
    expect(result.instructions).toContain('Optimize an agent');
  });

  it('reports notFound with the available ids for an unknown skill', async () => {
    const ctx = makeCtx();
    const result = await exec(createTraceyTools(ctx).load_skill, { skillId: 'nope' }, ctx) as {
      notFound: string; available: string[];
    };

    expect(result.notFound).toBe('nope');
    expect(result.available).toContain('optimize-agent');
  });
});

describe('tracey submit_optimization_theory tool', () => {
  beforeEach(() => vi.clearAllMocks());

  const details = { kind: 'SystemPrompt', currentSystemMessage: 'old', proposedSystemMessage: 'new' } as const;

  it('submits as Tracey AI when confirmed', async () => {
    agentsApi.get.mockResolvedValue({ id: 'a1', name: 'A' });
    theoriesApi.submit.mockResolvedValue({ id: 'th1', status: 'Proposed' });
    const ctx = makeCtx({ confirm: vi.fn().mockResolvedValue(true) });

    const result = await exec(createTraceyTools(ctx).submit_optimization_theory,
      { agentId: 'a1', suiteId: 's1', priority: Priority.High, rationale: 'why', details },
      ctx,
    );

    expect(ctx.confirm).toHaveBeenCalledOnce();
    expect(theoriesApi.submit).toHaveBeenCalledWith({
      agentId: 'a1', suiteId: 's1', priority: Priority.High, rationale: 'why',
      source: TheorySource.TraceyAi, details,
    });
    expect(result).toEqual({ id: 'th1', status: 'Proposed' });
  });

  it('cancels without submitting when declined', async () => {
    agentsApi.get.mockResolvedValue({ id: 'a1', name: 'A' });
    const ctx = makeCtx({ confirm: vi.fn().mockResolvedValue(false) });

    const result = await exec(createTraceyTools(ctx).submit_optimization_theory,
      { agentId: 'a1', suiteId: 's1', priority: Priority.Low, rationale: 'why', details },
      ctx,
    );

    expect(theoriesApi.submit).not.toHaveBeenCalled();
    expect(result).toBe(CANCELLED);
  });

  it('maps a 409 conflict to a duplicate outcome', async () => {
    agentsApi.get.mockResolvedValue({ id: 'a1', name: 'A' });
    theoriesApi.submit.mockRejectedValue(Object.assign(new Error('conflict'), { status: 409 }));
    const ctx = makeCtx({ confirm: vi.fn().mockResolvedValue(true) });

    const result = await exec(createTraceyTools(ctx).submit_optimization_theory,
      { agentId: 'a1', suiteId: 's1', priority: Priority.Medium, rationale: 'why', details },
      ctx,
    ) as { outcome: string };

    expect(result.outcome).toBe('duplicate');
  });

  it('maps a 429 to a quota outcome', async () => {
    agentsApi.get.mockResolvedValue({ id: 'a1', name: 'A' });
    theoriesApi.submit.mockRejectedValue(Object.assign(new Error('too many'), { status: 429 }));
    const ctx = makeCtx({ confirm: vi.fn().mockResolvedValue(true) });

    const result = await exec(createTraceyTools(ctx).submit_optimization_theory,
      { agentId: 'a1', suiteId: 's1', priority: Priority.Medium, rationale: 'why', details },
      ctx,
    ) as { outcome: string };

    expect(result.outcome).toBe('quota');
  });
});
