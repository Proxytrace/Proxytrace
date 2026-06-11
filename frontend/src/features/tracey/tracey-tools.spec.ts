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
  agentCallsApi: { get: vi.fn(), list: vi.fn() },
  statisticsApi: { dashboard: vi.fn(), agentOverview: vi.fn() },
  theoriesApi: { submit: vi.fn(), get: vi.fn(), getAll: vi.fn() },
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
    loadedSkillIds: new Set<string>(),
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
    const items = [
      { id: 'a1', name: 'Alpha', endpointName: 'gpt-4o', toolCount: 2 },
      { id: 'a2', name: 'Beta', endpointName: 'gpt-4o-mini', toolCount: 0 },
    ];
    agentsApi.list.mockResolvedValue({ items });
    const ctx = makeCtx();
    const result = await exec(createTraceyTools(ctx).list_agents, {}, ctx) as {
      artifactRef: string; kind: string;
      summary: { count: number; items: { id: string; name: string; endpointName: string; toolCount: number }[] };
    };

    expect(agentsApi.list).toHaveBeenCalledWith({ projectId: 'proj-1' });
    expect(result.kind).toBe('agent-list');
    expect(result.summary).toEqual({
      count: 2,
      items: [
        { id: 'a1', name: 'Alpha', endpointName: 'gpt-4o', toolCount: 2 },
        { id: 'a2', name: 'Beta', endpointName: 'gpt-4o-mini', toolCount: 0 },
      ],
    });
    expect(await getArtifact(result.artifactRef)).toEqual(items);
  });

  it('caps a large list digest and notes the truncation', async () => {
    const items = Array.from({ length: 30 }, (_, i) => ({
      id: `a${i}`, name: `Agent ${i}`, endpointName: 'gpt-4o', toolCount: 0,
    }));
    agentsApi.list.mockResolvedValue({ items });
    const ctx = makeCtx();
    const result = await exec(createTraceyTools(ctx).list_agents, {}, ctx) as {
      artifactRef: string;
      summary: { count: number; items: unknown[]; note?: string };
    };

    expect(result.summary.count).toBe(30);
    expect(result.summary.items).toHaveLength(25);
    expect(result.summary.note).toContain('first 25 of 30');
    // The card still gets everything.
    expect(await getArtifact(result.artifactRef)).toHaveLength(30);
  });

  it('falls back to the full payload inline when the artifact store is unavailable', async () => {
    const items = [{ id: 'a1', name: 'Alpha', endpointName: 'gpt-4o', toolCount: 1 }];
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

  it('start_test_run fires the run and stores the group, returning a compact summary', async () => {
    agentsApi.get.mockResolvedValue({ id: 'a1', name: 'A', endpointId: 'e1', endpointName: 'gpt' });
    testSuitesApi.get.mockResolvedValue({ id: 's1', name: 'Suite' });
    const group = { id: 'g1', suiteName: 'Suite', agentName: 'A', status: 'Pending', runs: [{ totalCases: 3 }, { totalCases: 2 }] };
    testRunGroupsApi.create.mockResolvedValue(group);
    const ctx = makeCtx({ confirm: vi.fn().mockResolvedValue(true) });

    const result = await exec(createTraceyTools(ctx).start_test_run, { suiteId: 's1', agentId: 'a1' }, ctx) as {
      artifactRef: string; kind: string;
      summary: { id: string; status: string; totalCases: number; awaitable: { kind: string; id: string } };
    };

    expect(ctx.confirm).toHaveBeenCalledOnce();
    expect(testRunGroupsApi.create).toHaveBeenCalledWith('s1', ['e1']);
    expect(result.kind).toBe('test-run-group');
    expect(result.summary).toEqual({
      id: 'g1', suiteName: 'Suite', agentName: 'A', status: 'Pending', totalCases: 5,
      awaitable: { kind: 'test-run', id: 'g1' },
    });
    expect(await getArtifact(result.artifactRef)).toEqual(group);
  });

  it('start_test_run cancels without calling the API when declined', async () => {
    agentsApi.get.mockResolvedValue({ id: 'a1', name: 'A', endpointId: 'e1', endpointName: 'gpt' });
    testSuitesApi.get.mockResolvedValue({ id: 's1', name: 'Suite' });
    const ctx = makeCtx({ confirm: vi.fn().mockResolvedValue(false) });

    const result = await exec(createTraceyTools(ctx).start_test_run, { suiteId: 's1', agentId: 'a1' }, ctx);

    expect(testRunGroupsApi.create).not.toHaveBeenCalled();
    expect(result).toBe(CANCELLED);
  });

  it('set_proposal_status updates when confirmed and returns only the id + status', async () => {
    proposalsApi.updateStatus.mockResolvedValue({
      id: 'p1', status: ProposalStatus.Accepted, kind: 'SystemPrompt', agentName: 'A',
      rationale: 'why', details: { proposedSystemMessage: 'a very long prompt body' },
    });
    const ctx = makeCtx({ confirm: vi.fn().mockResolvedValue(true) });

    const result = await exec(createTraceyTools(ctx).set_proposal_status,
      { proposalId: 'p1', status: ProposalStatus.Accepted },
      ctx,
    );

    expect(proposalsApi.updateStatus).toHaveBeenCalledWith('p1', ProposalStatus.Accepted);
    expect(result).toEqual({ id: 'p1', status: ProposalStatus.Accepted });
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

  it('find_traces searches with the given filter and returns a compact index', async () => {
    agentCallsApi.list.mockResolvedValue({
      items: [{
        id: 't1', agentName: 'Alpha', model: 'gpt-4o', httpStatus: 500,
        errorMessage: 'upstream exploded', durationMs: 900, inputTokens: 10, outputTokens: 5,
        messagePreview: 'hello there', createdAt: '2026-06-01T00:00:00Z',
      }],
    });
    const ctx = makeCtx();

    const result = await exec(createTraceyTools(ctx).find_traces,
      { agentId: 'a1', httpStatus: 500, limit: 5 },
      ctx,
    ) as { kind: string; summary: { count: number; items: { id: string; error?: string; tokens: number }[] } };

    expect(agentCallsApi.list).toHaveBeenCalledWith({
      projectId: 'proj-1', agentId: 'a1', q: undefined, httpStatus: 500, pageSize: 5,
    });
    expect(result.kind).toBe('trace-list');
    expect(result.summary.count).toBe(1);
    expect(result.summary.items[0]).toMatchObject({ id: 't1', error: 'upstream exploded', tokens: 15 });
  });

  it('get_run_failures keeps only judged failures and digests evaluator verdicts', async () => {
    testRunsApi.get.mockResolvedValue({
      id: 'r1', suiteName: 'Suite', agentName: 'Alpha', passRate: 50, totalCases: 2,
      results: [
        {
          id: 'res1', testCaseId: 'c1', testCaseSummary: 'failing case', actualResponse: 'wrong answer',
          durationMs: 5,
          evaluations: [{ evaluatorId: 'e1', evaluatorKind: 'ExactMatch', evaluatorName: 'Exact', score: 'Bad', reasoning: 'mismatch', errorMessage: null }],
        },
        {
          id: 'res2', testCaseId: 'c2', testCaseSummary: 'passing case', actualResponse: 'right',
          durationMs: 5,
          evaluations: [{ evaluatorId: 'e1', evaluatorKind: 'ExactMatch', evaluatorName: 'Exact', score: 'Good', reasoning: null, errorMessage: null }],
        },
      ],
    });
    const ctx = makeCtx();

    const result = await exec(createTraceyTools(ctx).get_run_failures, { runId: 'r1' }, ctx) as {
      kind: string;
      summary: { failedCases: number; failures: { case: string; evaluations: { evaluator: string; score: string }[] }[] };
    };

    expect(result.kind).toBe('run-failures');
    expect(result.summary.failedCases).toBe(1);
    expect(result.summary.failures[0].case).toBe('failing case');
    expect(result.summary.failures[0].evaluations[0]).toMatchObject({ evaluator: 'Exact', score: 'Bad' });
  });

  it('compare_runs fetches both runs and digests the case movements', async () => {
    const evalOf = (score: string) =>
      [{ evaluatorId: 'e1', evaluatorKind: 'ExactMatch', evaluatorName: 'Exact', score, reasoning: null, errorMessage: null }];
    testRunsApi.get
      .mockResolvedValueOnce({
        id: 'old', agentName: 'A', endpointName: 'gpt', suiteName: 'Suite', passRate: 50,
        results: [
          { id: '1', testCaseId: 'c1', testCaseSummary: 'was failing', actualResponse: '', durationMs: 1, evaluations: evalOf('Bad') },
        ],
      })
      .mockResolvedValueOnce({
        id: 'new', agentName: 'A', endpointName: 'gpt', suiteName: 'Suite', passRate: 100,
        results: [
          { id: '2', testCaseId: 'c1', testCaseSummary: 'was failing', actualResponse: '', durationMs: 1, evaluations: evalOf('Good') },
        ],
      });
    const ctx = makeCtx();

    const result = await exec(createTraceyTools(ctx).compare_runs,
      { baselineRunId: 'old', candidateRunId: 'new' },
      ctx,
    ) as { kind: string; summary: { fixed: number; regressed: number; fixedCases: string[] } };

    expect(result.kind).toBe('run-comparison');
    expect(result.summary.fixed).toBe(1);
    expect(result.summary.regressed).toBe(0);
    expect(result.summary.fixedCases).toEqual(['was failing']);
  });

  it('list_theories returns the tried theories with their A/B outcomes', async () => {
    theoriesApi.getAll.mockResolvedValue([{
      id: 'th1', kind: 'SystemPrompt', status: 'Invalidated', priority: 'Medium', agentName: 'Alpha',
      rationale: 'tone too informal', baselinePassRate: 60, projectedPassRate: 55, resultingProposalId: null,
    }]);
    const ctx = makeCtx();

    const result = await exec(createTraceyTools(ctx).list_theories, { agentId: 'a1' }, ctx) as {
      kind: string; summary: { count: number; items: { id: string; status: string }[] };
    };

    expect(theoriesApi.getAll).toHaveBeenCalledWith({ projectId: 'proj-1', agentId: 'a1' });
    expect(result.kind).toBe('theory-list');
    expect(result.summary.items[0]).toMatchObject({ id: 'th1', status: 'Invalidated' });
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

  it('answers a repeat load compactly instead of re-injecting the playbook', async () => {
    const ctx = makeCtx();
    const tool = createTraceyTools(ctx).load_skill;
    await exec(tool, { skillId: 'optimize-agent' }, ctx);

    const repeat = await exec(tool, { skillId: 'optimize-agent' }, ctx) as {
      name: string; alreadyLoaded?: boolean; instructions?: string;
    };

    expect(repeat.alreadyLoaded).toBe(true);
    expect(repeat.instructions).toBeUndefined();
    expect(ctx.loadedSkillIds.has('optimize-agent')).toBe(true);
  });

  it('treats a skill restored from the conversation history as already loaded', async () => {
    const ctx = makeCtx({ loadedSkillIds: new Set(['review-proposals']) });

    const result = await exec(createTraceyTools(ctx).load_skill, { skillId: 'review-proposals' }, ctx) as {
      alreadyLoaded?: boolean;
    };

    expect(result.alreadyLoaded).toBe(true);
  });
});

describe('tracey get_dashboard_stats tool', () => {
  beforeEach(() => vi.clearAllMocks());

  it('digest carries per-agent and per-model usage breakdowns', async () => {
    statisticsApi.dashboard.mockResolvedValue({
      summary: { totalCalls: 5 },
      agentBreakdown: [{ agentId: 'a1', callCount: 5 }],
      tokenUsageByAgent: [
        { bucketStart: 'b1', agentId: 'a1', inputTokens: 10, outputTokens: 5 },
        { bucketStart: 'b2', agentId: 'a1', inputTokens: 20, outputTokens: 15 },
      ],
      modelBreakdown: [
        { endpointId: 'e1', modelName: 'gpt-4o', callCount: 5, totalInputTokens: 30, totalOutputTokens: 20, avgDurationMs: 800 },
      ],
      agents: [
        { id: 'a1', name: 'Alpha' },
        { id: 'a2', name: 'Beta' },
      ],
    });
    const ctx = makeCtx();

    const result = await exec(createTraceyTools(ctx).get_dashboard_stats, {}, ctx) as {
      kind: string;
      summary: {
        summary: Record<string, unknown>;
        byAgent: { id: string; name: string; calls: number; inputTokens: number; outputTokens: number }[];
        byModel: { model: string; calls: number }[];
      };
    };

    expect(result.kind).toBe('dashboard-stats');
    expect(result.summary.summary).toEqual({ totalCalls: 5 });
    expect(result.summary.byAgent).toEqual([
      { id: 'a1', name: 'Alpha', calls: 5, inputTokens: 30, outputTokens: 20 },
      { id: 'a2', name: 'Beta', calls: 0, inputTokens: 0, outputTokens: 0 },
    ]);
    expect(result.summary.byModel).toEqual([
      { model: 'gpt-4o', calls: 5, inputTokens: 30, outputTokens: 20, avgDurationMs: 800 },
    ]);
  });
});

describe('tracey submit_optimization_theory tool', () => {
  beforeEach(() => vi.clearAllMocks());

  const details = { kind: 'SystemPrompt', currentSystemMessage: 'old', proposedSystemMessage: 'new' } as const;

  it('submits as Tracey AI when confirmed, storing the full theory and returning a digest', async () => {
    agentsApi.get.mockResolvedValue({ id: 'a1', name: 'A' });
    const theory = {
      id: 'th1', kind: 'SystemPrompt', status: 'Proposed', agentName: 'A', priority: Priority.High,
      rationale: 'why', details,
    };
    theoriesApi.submit.mockResolvedValue(theory);
    const ctx = makeCtx({ confirm: vi.fn().mockResolvedValue(true) });

    const result = await exec(createTraceyTools(ctx).submit_optimization_theory,
      { agentId: 'a1', suiteId: 's1', priority: Priority.High, rationale: 'why', details },
      ctx,
    ) as { artifactRef: string; kind: string; summary: Record<string, unknown> };

    expect(ctx.confirm).toHaveBeenCalledOnce();
    expect(theoriesApi.submit).toHaveBeenCalledWith({
      agentId: 'a1', suiteId: 's1', priority: Priority.High, rationale: 'why',
      source: TheorySource.TraceyAi, details,
    });
    expect(result.kind).toBe('theory');
    // The digest must not echo the proposed change body back into the model context.
    expect(result.summary).toEqual({
      id: 'th1', kind: 'SystemPrompt', status: 'Proposed', agentName: 'A', priority: Priority.High,
      awaitable: { kind: 'theory', id: 'th1' },
    });
    expect(await getArtifact(result.artifactRef)).toEqual(theory);
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
