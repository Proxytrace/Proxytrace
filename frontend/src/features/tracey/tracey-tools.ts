import { z } from 'zod';
import { agentsApi } from '../../api/agents';
import { testSuitesApi } from '../../api/test-suites';
import { testRunsApi } from '../../api/test-runs';
import { testRunGroupsApi } from '../../api/test-run-groups';
import { proposalsApi } from '../../api/proposals';
import { statisticsApi } from '../../api/statistics';
import { ProposalStatus } from '../../api/models';

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
 * schema); `execute` runs client-side. This is the single source of truth — the backend
 * `TraceyDefinition` mirrors the same shapes onto the stored Tracey agent.
 */
export interface TraceyTool<TArgs = Record<string, unknown>> {
  description: string;
  parameters: z.ZodType<TArgs>;
  /** Whether this tool mutates state and must be confirmed when auto-approve is off. */
  confirm: boolean;
  execute: (args: TArgs, ctx: TraceyToolContext) => Promise<unknown>;
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
      parameters: z.object({ path: z.string() }),
      confirm: false,
      execute: async ({ path }) => {
        ctx.navigate(path);
        return { navigatedTo: path };
      },
    }),

    list_agents: tool({
      description: 'List the agents in the current project.',
      parameters: empty,
      confirm: false,
      execute: async () => (await agentsApi.list({ projectId })).items,
    }),
    get_agent: tool({
      description: 'Get a single agent by id.',
      parameters: z.object({ agentId: z.string() }),
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
      parameters: z.object({ suiteId: z.string() }),
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
      parameters: z.object({ runId: z.string() }),
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
      parameters: z.object({ proposalId: z.string() }),
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
      description: 'Get statistics for a single agent (token usage, costs, latencies).',
      parameters: z.object({ agentId: z.string() }),
      confirm: false,
      execute: async ({ agentId }) => statisticsApi.agentCounts(agentId),
    }),

    start_test_run: tool({
      description: 'Start a test run of a suite against an agent. Requires user confirmation.',
      parameters: z.object({ suiteId: z.string(), agentId: z.string() }),
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
        proposalId: z.string(),
        status: z.enum([ProposalStatus.Accepted, ProposalStatus.Rejected]),
      }),
      confirm: true,
      execute: async ({ proposalId, status }, c) => {
        const ok = await c.confirm(`Set proposal ${proposalId} to ${status}?`);
        if (!ok) return CANCELLED;
        return proposalsApi.updateStatus(proposalId, status);
      },
    }),
  };
}
