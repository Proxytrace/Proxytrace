import { z } from 'zod';
import { agentsApi } from '../../api/agents';
import { testSuitesApi } from '../../api/test-suites';
import { testRunsApi } from '../../api/test-runs';
import { testRunGroupsApi } from '../../api/test-run-groups';
import { proposalsApi } from '../../api/proposals';
import { providersApi } from '../../api/providers';
import { agentCallsApi } from '../../api/agent-calls';
import { statisticsApi } from '../../api/statistics';
import { ProposalStatus } from '../../api/models';
import { searchDocs } from './knowledge/search-docs';
import { DOCS_INDEX } from './knowledge/docs-index.generated';

/**
 * Runtime context the Tracey tools execute against. Read tools call the typed `src/api`
 * services; `navigate` performs a client-side route change; `confirm` gates write tools
 * (auto-approve resolves it to `true` without prompting).
 */
export interface TraceyToolContext {
  projectId?: string;
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

    list_agents: tool({
      description: 'List the agents in the current project.',
      parameters: empty,
      confirm: false,
      execute: async () => (await agentsApi.list({ projectId })).items,
    }),
    get_agent: tool({
      description: 'Get a single agent by id.',
      parameters: z.object({ agentId: z.string().describe('The id of the agent to fetch.') }),
      confirm: false,
      execute: async ({ agentId }) => agentsApi.get(agentId),
    }),

    list_suites: tool({
      description: 'List the test suites in the current project.',
      parameters: empty,
      confirm: false,
      execute: async () => (await testSuitesApi.list({ projectId })).items,
    }),
    get_suite: tool({
      description: 'Get a single test suite by id.',
      parameters: z.object({ suiteId: z.string().describe('The id of the test suite to fetch.') }),
      confirm: false,
      execute: async ({ suiteId }) => testSuitesApi.get(suiteId),
    }),

    list_runs: tool({
      description: 'List recent test runs.',
      parameters: empty,
      confirm: false,
      execute: async () => (await testRunsApi.list({})).items,
    }),
    get_run: tool({
      description: 'Get a single test run by id.',
      parameters: z.object({ runId: z.string().describe('The id of the test run to fetch.') }),
      confirm: false,
      execute: async ({ runId }) => testRunsApi.get(runId),
    }),

    list_proposals: tool({
      description: 'List optimization proposals.',
      parameters: empty,
      confirm: false,
      execute: async () => proposalsApi.getAll({ projectId }),
    }),
    get_proposal: tool({
      description: 'Get a single optimization proposal by id.',
      parameters: z.object({ proposalId: z.string().describe('The id of the optimization proposal to fetch.') }),
      confirm: false,
      // The proposals API has no single-get; resolve from the list.
      execute: async ({ proposalId }) => {
        const all = await proposalsApi.getAll({ projectId });
        return all.find(p => p.id === proposalId) ?? { notFound: proposalId };
      },
    }),

    get_dashboard_stats: tool({
      description: 'Get aggregate dashboard statistics for the current project.',
      parameters: empty,
      confirm: false,
      execute: async () => statisticsApi.dashboard({ projectId }),
    }),
    get_agent_stats: tool({
      description: 'Get statistics for a single agent (token usage, costs, latencies) over the last 30 days.',
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
        return { summary: overview.summary, counts: overview.counts };
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

    get_provider: tool({
      description: 'Get a single model provider by id.',
      parameters: z.object({ providerId: z.string().describe('The id of the provider to fetch.') }),
      confirm: false,
      execute: async ({ providerId }) => providersApi.get(providerId),
    }),
    get_trace: tool({
      description:
        'Get a single captured trace (agent call) by id, with its model, status, token usage, latency and cost.',
      parameters: z.object({ traceId: z.string().describe('The id of the trace / agent call to fetch.') }),
      confirm: false,
      execute: async ({ traceId }) => agentCallsApi.get(traceId),
    }),

    show_chart: tool({
      description:
        'Render a chart inline in the chat to visualize data (e.g. token usage, pass rates over time). Prefer this over dumping numbers in chat.',
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
        ({ kind: 'chart', title, chartType: type, points }),
    }),
    show_table: tool({
      description: 'Render a table inline in the chat. Use for tabular comparisons.',
      parameters: z.object({
        title: z.string().describe('Heading shown above the table.'),
        columns: z.array(z.string()).describe('Column header labels, left to right.'),
        rows: z.array(z.array(z.union([z.string(), z.number()])))
          .describe('Table rows; each row is an array of cells aligned to "columns".'),
      }),
      confirm: false,
      execute: async ({ title, columns, rows }) => ({ kind: 'table', title, columns, rows }),
    }),
    show_text: tool({
      description:
        'Render a longer text block (markdown, JSON, or code) inline in the chat as a titled card.',
      parameters: z.object({
        title: z.string().describe('Heading shown above the text.'),
        format: z.enum(['markdown', 'json', 'code']).describe('How to render the content.'),
        content: z.string().describe('The full text body to render.'),
      }),
      confirm: false,
      execute: async ({ title, format, content }) => ({ kind: 'text', title, format, content }),
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
  { name: 'show_chart', description: 'Plot data inline in the chat.' },
  { name: 'show_table', description: 'Show a table inline in the chat.' },
  { name: 'show_text', description: 'Show markdown/JSON/code inline in the chat.' },
  { name: 'ask_questions', description: 'Ask the user one or more clarifying questions inline.' },
];
