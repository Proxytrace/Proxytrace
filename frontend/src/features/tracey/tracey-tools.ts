import { z } from 'zod';
import { agentsApi } from '../../api/agents';
import { testSuitesApi } from '../../api/test-suites';
import { testRunsApi } from '../../api/test-runs';
import { testRunGroupsApi } from '../../api/test-run-groups';
import { proposalsApi } from '../../api/proposals';
import { providersApi } from '../../api/providers';
import { agentCallsApi } from '../../api/agent-calls';
import { statisticsApi } from '../../api/statistics';
import { theoriesApi } from '../../api/theories';
import { Priority, ProposalStatus, TheorySource } from '../../api/models';
import { searchDocs } from './knowledge/search-docs';
import { DOCS_INDEX } from './knowledge/docs-index.generated';
import { getSkill, listSkills } from './skills/registry';
import { storeArtifact } from './tracey-artifact-store';

/** Seed-style proposed-change payloads accepted by `submit_optimization_theory`. */
const theoryDetailsSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('SystemPrompt'),
    currentSystemMessage: z.string().describe("The agent's current system message."),
    proposedSystemMessage: z.string().describe('The full rewritten system message to test.'),
  }),
  z.object({
    kind: z.literal('ModelSwitchSeed'),
    proposedEndpointId: z.string().describe('Id of the ModelEndpoint to switch the agent to.'),
  }),
  z.object({
    kind: z.literal('ToolUpdateSeed'),
    proposedTools: z.array(z.object({
      name: z.string().describe('Tool name.'),
      description: z.string().describe('What the tool does.'),
      parametersJson: z.string().nullable().describe('JSON-schema for the arguments, or null for none.'),
    })).describe('The full proposed tool set (replaces the current tools).'),
  }),
]);

/**
 * Runtime context the Tracey tools execute against. Read tools call the typed `src/api`
 * services; `navigate` performs a client-side route change; `confirm` gates write tools
 * (auto-approve resolves it to `true` without prompting).
 */
export interface TraceyToolContext {
  projectId?: string;
  /**
   * `${userKey}:${projectKey}` scope under which large tool payloads are stored in the artifact
   * store, so a thread reset can wipe exactly this user+project's blobs.
   */
  artifactScope: string;
  navigate: (path: string) => void;
  /** Resolves `true` to proceed with a write, `false` to cancel. */
  confirm: (summary: string) => Promise<boolean>;
}

/**
 * A single Tracey tool. `parameters` is a zod schema (the AI runtime turns it into a JSON
 * schema); `execute` runs client-side. This is the sole source of truth for Tracey's tool set:
 * the backend stores no copy — it captures the prompt + tools from the wire on her first call
 * and versions them under her name-attributed agent.
 */
export interface TraceyTool<TArgs = Record<string, unknown>> {
  description: string;
  parameters: z.ZodType<TArgs>;
  /** Whether this tool mutates state and must be confirmed when auto-approve is off. */
  confirm: boolean;
  /**
   * Runs the tool client-side. Omitted for human-in-the-loop tools (e.g. `ask_questions`)
   * whose UI supplies the result via assistant-ui's `addResult`, pausing the turn until the
   * user responds instead of resolving immediately.
   */
  execute?: (args: TArgs, ctx: TraceyToolContext) => Promise<unknown>;
}

const empty = z.object({});

/** Result a write tool returns when the user declines the confirmation. */
export const CANCELLED = { cancelled: true } as const;

export function createTraceyTools(ctx: TraceyToolContext): Record<string, TraceyTool> {
  const projectId = ctx.projectId;

  const tool = <TArgs>(t: TraceyTool<TArgs>): TraceyTool =>
    t as unknown as TraceyTool;

  // Stash a large payload in the browser artifact store and hand the model only a compact
  // reference + digest. The inline tool-UI card resolves the reference back to the full data, so
  // the rich result reaches the user without ever entering the model context. If the store is
  // unavailable (e.g. IndexedDB disabled in private browsing), fall back to returning the full
  // payload inline — the card renders it either way; only this failure mode costs model context.
  const store = async <S>(kind: string, full: unknown, summary: S): Promise<unknown> => {
    try {
      return await storeArtifact(ctx.artifactScope, kind, full, summary);
    } catch {
      return full;
    }
  };

  return {
    navigate: tool({
      description: 'Navigate the user to an in-app route. Use a relative path like /agents or /runs/{id}.',
      parameters: z.object({
        path: z.string().describe('Relative in-app route to open, e.g. "/agents" or "/runs/{runId}".'),
      }),
      confirm: false,
      execute: async ({ path }) => {
        ctx.navigate(path);
        return { navigatedTo: path };
      },
    }),

    search_docs: tool({
      description:
        'Search the Proxytrace product manual (the user guide at /docs) for how-to, ' +
        'what-is, setup, and conceptual questions about using Proxytrace itself. Returns the ' +
        'most relevant manual sections, each with a `url` you MUST cite back to the user as an ' +
        'inline markdown link. Use this for product questions; use the data tools for the ' +
        "user's own agents, runs, and stats.",
      parameters: z.object({
        query: z.string().describe('Natural-language search query, e.g. "how do I set up the proxy".'),
        limit: z.number().int().min(1).max(8).optional()
          .describe('Max sections to return (default 4).'),
      }),
      confirm: false,
      execute: async ({ query, limit }) => ({ results: searchDocs(query, DOCS_INDEX, limit ?? 4) }),
    }),

    load_skill: tool({
      description:
        'Load a skill — a detailed step-by-step playbook for a specific task — into the ' +
        "conversation on demand. Call this with the skill's id BEFORE acting whenever the " +
        "user's request matches one of the skills listed in your system prompt. The full " +
        'instructions come back as this tool result; follow them.',
      parameters: z.object({
        skillId: z.string().describe('The id of the skill to load, e.g. "optimize-agent".'),
      }),
      confirm: false,
      execute: async ({ skillId }) => {
        const skill = getSkill(skillId);
        if (!skill) {
          return { notFound: skillId, available: listSkills().map((s) => s.name) };
        }
        return { name: skill.name, instructions: skill.instructions };
      },
    }),

    list_agents: tool({
      description:
        'List the agents in the current project. Returns a compact index (each agent\'s id + name) ' +
        'plus a reference; the full list is rendered to the user as a card. To inspect one agent, ' +
        'call get_agent with its id.',
      parameters: empty,
      confirm: false,
      execute: async () => {
        const items = (await agentsApi.list({ projectId })).items;
        return store('agent-list', items, {
          count: items.length,
          items: items.map((a) => ({ id: a.id, name: a.name })),
        });
      },
    }),
    get_agent: tool({
      description:
        'Get a single agent by id. Returns a curated summary (name, endpoint, tool count, system ' +
        'prompt preview) plus a reference; the full agent is rendered to the user as a card.',
      parameters: z.object({ agentId: z.string().describe('The id of the agent to fetch.') }),
      confirm: false,
      execute: async ({ agentId }) => {
        const agent = await agentsApi.get(agentId);
        return store('agent', agent, {
          id: agent.id,
          name: agent.name,
          endpointName: agent.endpointName,
          toolCount: agent.tools.length,
          systemPromptPreview: agent.systemMessage.slice(0, 200),
        });
      },
    }),

    list_suites: tool({
      description:
        'List the test suites in the current project. Returns a compact index (id + name) plus a ' +
        'reference; the full list is rendered to the user. To inspect one suite, call get_suite.',
      parameters: empty,
      confirm: false,
      execute: async () => {
        const items = (await testSuitesApi.list({ projectId })).items;
        return store('suite-list', items, {
          count: items.length,
          items: items.map((s) => ({ id: s.id, name: s.name })),
        });
      },
    }),
    get_suite: tool({
      description:
        'Get a single test suite by id. Returns a curated summary (name, case count, pass rate) ' +
        'plus a reference; the full suite is rendered to the user as a card.',
      parameters: z.object({ suiteId: z.string().describe('The id of the test suite to fetch.') }),
      confirm: false,
      execute: async ({ suiteId }) => {
        const suite = await testSuitesApi.get(suiteId);
        return store('suite', suite, {
          id: suite.id,
          name: suite.name,
          caseCount: suite.testCases.length,
          passRate: suite.passRate,
        });
      },
    }),

    list_runs: tool({
      description:
        'List recent test runs. Returns a compact index (id, suite, agent, status, pass rate) plus ' +
        'a reference; the full list is rendered to the user. To inspect one run, call get_run.',
      parameters: empty,
      confirm: false,
      execute: async () => {
        const items = (await testRunsApi.list({})).items;
        return store('run-list', items, {
          count: items.length,
          items: items.map((r) => ({
            id: r.id, suiteName: r.suiteName, agentName: r.agentName, status: r.status, passRate: r.passRate,
          })),
        });
      },
    }),
    get_run: tool({
      description:
        'Get a single test run by id. Returns a curated summary (suite, agent, status, pass/fail ' +
        'counts) plus a reference; the full run is rendered to the user as a card.',
      parameters: z.object({ runId: z.string().describe('The id of the test run to fetch.') }),
      confirm: false,
      execute: async ({ runId }) => {
        const run = await testRunsApi.get(runId);
        return store('run', run, {
          id: run.id,
          suiteName: run.suiteName,
          agentName: run.agentName,
          status: run.status,
          passRate: run.passRate,
          passedCases: run.passedCases,
          failedCases: run.failedCases,
          totalCases: run.totalCases,
        });
      },
    }),

    list_proposals: tool({
      description:
        'List optimization proposals. Returns a compact index (id, kind, status, priority, agent) ' +
        'plus a reference; the full list is rendered to the user. To inspect one, call get_proposal.',
      parameters: empty,
      confirm: false,
      execute: async () => {
        const items = await proposalsApi.getAll({ projectId });
        return store('proposal-list', items, {
          count: items.length,
          items: items.map((p) => ({
            id: p.id, kind: p.kind, status: p.status, priority: p.priority, agentName: p.agentName,
          })),
        });
      },
    }),
    get_proposal: tool({
      description:
        'Get a single optimization proposal by id. Returns a curated summary (kind, status, ' +
        'priority, expected pass-rate delta) plus a reference; the full proposal is rendered to the user.',
      parameters: z.object({ proposalId: z.string().describe('The id of the optimization proposal to fetch.') }),
      confirm: false,
      // The proposals API has no single-get; resolve from the list.
      execute: async ({ proposalId }) => {
        const all = await proposalsApi.getAll({ projectId });
        const proposal = all.find(p => p.id === proposalId);
        if (!proposal) return { notFound: proposalId };
        return store('proposal', proposal, {
          id: proposal.id,
          kind: proposal.kind,
          status: proposal.status,
          priority: proposal.priority,
          agentName: proposal.agentName,
          expectedPassRateDelta: proposal.expectedPassRateDelta,
        });
      },
    }),

    get_dashboard_stats: tool({
      description:
        'Get aggregate dashboard statistics for the current project. Returns the headline summary ' +
        'plus a reference; the full dashboard is rendered to the user as a card.',
      parameters: empty,
      confirm: false,
      execute: async () => {
        const view = await statisticsApi.dashboard({ projectId });
        return store('dashboard-stats', view, { summary: view.summary });
      },
    }),
    get_agent_stats: tool({
      description:
        'Get statistics for a single agent (token usage, costs, latencies) over the last 30 days. ' +
        'Returns the headline summary plus a reference; the full stats are rendered to the user as a card.',
      parameters: z.object({ agentId: z.string().describe('The id of the agent to fetch statistics for.') }),
      confirm: false,
      execute: async ({ agentId }) => {
        const to = new Date();
        const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
        const overview = await statisticsApi.agentOverview(agentId, {
          from: from.toISOString(),
          to: to.toISOString(),
          bucket: 'daily',
        });
        const full = { summary: overview.summary, counts: overview.counts };
        return store('agent-stats', full, { summary: overview.summary });
      },
    }),

    start_test_run: tool({
      description: 'Start a test run of a suite against an agent. Requires user confirmation.',
      parameters: z.object({
        suiteId: z.string().describe('The id of the test suite to run.'),
        agentId: z.string().describe('The id of the agent to run the suite against.'),
      }),
      confirm: true,
      execute: async ({ suiteId, agentId }, c) => {
        const agent = await agentsApi.get(agentId);
        const suite = await testSuitesApi.get(suiteId);
        const ok = await c.confirm(`Run suite "${suite.name}" against agent "${agent.name}" (${agent.endpointName})?`);
        if (!ok) return CANCELLED;
        return testRunGroupsApi.create(suiteId, [agent.endpointId]);
      },
    }),
    set_proposal_status: tool({
      description: 'Approve (Accepted) or reject a proposal. Requires user confirmation.',
      parameters: z.object({
        proposalId: z.string().describe('The id of the proposal to update.'),
        status: z.enum([ProposalStatus.Accepted, ProposalStatus.Rejected])
          .describe('The new status: "Accepted" to approve, "Rejected" to reject.'),
      }),
      confirm: true,
      execute: async ({ proposalId, status }, c) => {
        const ok = await c.confirm(`Set proposal ${proposalId} to ${status}?`);
        if (!ok) return CANCELLED;
        return proposalsApi.updateStatus(proposalId, status);
      },
    }),
    submit_optimization_theory: tool({
      description:
        'Submit an optimization theory for an agent — a concrete proposed change (system prompt, ' +
        'model switch, or tool update) that the backend A/B-tests against the agent\'s suite. ' +
        'Spawns a reviewable proposal if it improves the pass rate, otherwise it is rejected. ' +
        'Use the `optimize-agent` skill to drive this. Requires user confirmation.',
      parameters: z.object({
        agentId: z.string().describe('The id of the agent to optimize.'),
        suiteId: z.string().describe('The id of the test suite to validate the change against.'),
        priority: z.enum([Priority.Low, Priority.Medium, Priority.High, Priority.Critical])
          .describe('How strongly the evidence supports this change.'),
        rationale: z.string().describe('One-sentence, evidence-grounded reason the change should help.'),
        details: theoryDetailsSchema,
      }),
      confirm: true,
      execute: async ({ agentId, suiteId, priority, rationale, details }, c) => {
        const agent = await agentsApi.get(agentId);
        const ok = await c.confirm(
          `Submit a ${details.kind === 'ModelSwitchSeed' ? 'model-switch' : details.kind === 'ToolUpdateSeed' ? 'tool-update' : 'system-prompt'} ` +
          `optimization theory for "${agent.name}" and run an A/B test?`,
        );
        if (!ok) return CANCELLED;
        try {
          return await theoriesApi.submit({ agentId, suiteId, priority, rationale, source: TheorySource.TraceyAi, details });
        } catch (error) {
          const status = (error as { status?: number }).status;
          if (status === 409) return { outcome: 'duplicate', message: 'An identical theory or proposal already exists for this agent.' };
          if (status === 429) return { outcome: 'quota', message: 'Too many theories are awaiting validation. Try again later.' };
          return { outcome: 'error', message: error instanceof Error ? error.message : 'Failed to submit the theory.' };
        }
      },
    }),

    get_provider: tool({
      description:
        'Get a single model provider by id. Returns a curated summary (name, kind) plus a ' +
        'reference; the full provider is rendered to the user as a card.',
      parameters: z.object({ providerId: z.string().describe('The id of the provider to fetch.') }),
      confirm: false,
      execute: async ({ providerId }) => {
        const provider = await providersApi.get(providerId);
        return store('provider', provider, { id: provider.id, name: provider.name, kind: provider.kind });
      },
    }),
    get_trace: tool({
      description:
        'Get a single captured trace (agent call) by id. Returns a curated summary (model, status, ' +
        'token usage, latency, cost) plus a reference; the full trace is rendered to the user as a card.',
      parameters: z.object({ traceId: z.string().describe('The id of the trace / agent call to fetch.') }),
      confirm: false,
      execute: async ({ traceId }) => {
        const call = await agentCallsApi.get(traceId);
        return store('trace', call, {
          id: call.id,
          model: call.model,
          provider: call.provider,
          httpStatus: call.httpStatus,
          inputTokens: call.inputTokens,
          outputTokens: call.outputTokens,
          durationMs: call.durationMs,
          costEur: call.costEur,
        });
      },
    }),

    show_chart: tool({
      description:
        'Render a chart inline in the chat to visualize data (e.g. token usage, pass rates over time). ' +
        'Prefer this over dumping numbers in chat. The chart is rendered to the user; you receive only ' +
        'a reference back, so you do not need to restate the data.',
      parameters: z.object({
        title: z.string().describe('Heading shown above the chart.'),
        type: z.enum(['bar', 'line', 'area']).describe('The chart style to render.'),
        points: z.array(z.object({
          label: z.string().describe('X-axis label for this data point.'),
          value: z.number().describe('Numeric value for this data point.'),
        })).describe('The data points to plot, in display order.'),
      }),
      confirm: false,
      execute: async ({ title, type, points }) =>
        store('chart', { kind: 'chart', title, chartType: type, points }, { kind: 'chart', title }),
    }),
    show_table: tool({
      description:
        'Render a table inline in the chat. Use for tabular comparisons. The table is rendered to the ' +
        'user; you receive only a reference back.',
      parameters: z.object({
        title: z.string().describe('Heading shown above the table.'),
        columns: z.array(z.string()).describe('Column header labels, left to right.'),
        rows: z.array(z.array(z.union([z.string(), z.number()])))
          .describe('Table rows; each row is an array of cells aligned to "columns".'),
      }),
      confirm: false,
      execute: async ({ title, columns, rows }) =>
        store('table', { kind: 'table', title, columns, rows }, { kind: 'table', title }),
    }),
    show_text: tool({
      description:
        'Render a longer text block (markdown, JSON, or code) inline in the chat as a titled card. ' +
        'The block is rendered to the user; you receive only a reference back.',
      parameters: z.object({
        title: z.string().describe('Heading shown above the text.'),
        format: z.enum(['markdown', 'json', 'code']).describe('How to render the content.'),
        content: z.string().describe('The full text body to render.'),
      }),
      confirm: false,
      execute: async ({ title, format, content }) =>
        store('text', { kind: 'text', title, format, content }, { kind: 'text', title }),
    }),

    ask_questions: tool({
      description:
        'Ask the user one or more clarifying questions before acting. Rendered inline as a ' +
        'stepped widget (one question at a time). Each question shows 2–4 options as a vertical ' +
        'list plus a static "Something else" free-text field. Set `multiple: true` to let the ' +
        'user pick several options for that question. Prefer this over asking in plain prose ' +
        '(disambiguation, gathering a few decisions, free-form input). You receive the user’s ' +
        'answers as this tool’s result (an `answers` array of `{ question, answer }`); continue ' +
        'once they arrive.',
      parameters: z.object({
        questions: z.array(z.object({
          id: z.string().describe('Machine key for this question, returned with its answer.'),
          question: z.string().describe('The question text shown to the user.'),
          multiple: z.boolean().optional().describe('Allow selecting more than one option.'),
          options: z.array(z.object({
            label: z.string().describe('Option label shown to the user.'),
            value: z.string().describe('Text recorded as the answer when this option is picked.'),
          })).min(2).max(4).describe('The 2–4 options offered, in display order.'),
        })).min(1).describe('Questions to ask in sequence, one at a time.'),
      }),
      confirm: false,
      // No execute: human-in-the-loop. The tool UI resolves it via addResult once the user answers.
    }),
  };
}

/**
 * Static name + description for every Tracey tool, for the slash menu / chips. Must stay in sync
 * with {@link createTraceyTools} — every tool defined there has an entry here.
 */
export const TRACEY_TOOLS_META: { name: string; description: string }[] = [
  { name: 'navigate', description: 'Open an in-app page.' },
  { name: 'search_docs', description: 'Search the product manual and cite sources.' },
  { name: 'load_skill', description: 'Load a task playbook (skill) on demand.' },
  { name: 'list_agents', description: 'List the agents in the project.' },
  { name: 'get_agent', description: 'Get one agent by id.' },
  { name: 'list_suites', description: 'List the test suites.' },
  { name: 'get_suite', description: 'Get one test suite by id.' },
  { name: 'list_runs', description: 'List recent test runs.' },
  { name: 'get_run', description: 'Get one test run by id.' },
  { name: 'list_proposals', description: 'List optimization proposals.' },
  { name: 'get_proposal', description: 'Get one proposal by id.' },
  { name: 'get_provider', description: 'Get one model provider by id.' },
  { name: 'get_trace', description: 'Get one captured trace by id.' },
  { name: 'get_dashboard_stats', description: 'Aggregate dashboard statistics.' },
  { name: 'get_agent_stats', description: 'Token usage, cost & latency for an agent.' },
  { name: 'start_test_run', description: 'Run a suite against an agent (confirm).' },
  { name: 'set_proposal_status', description: 'Approve or reject a proposal (confirm).' },
  { name: 'submit_optimization_theory', description: 'Theorize an agent optimization and A/B-test it (confirm).' },
  { name: 'show_chart', description: 'Plot data inline in the chat.' },
  { name: 'show_table', description: 'Show a table inline in the chat.' },
  { name: 'show_text', description: 'Show markdown/JSON/code inline in the chat.' },
  { name: 'ask_questions', description: 'Ask the user one or more clarifying questions inline.' },
];
