import { z } from 'zod';
import { statisticsApi } from '../../../api/statistics';
import { type ToolFactory, tool, empty } from './shared';

export const createStatsTools: ToolFactory = (ctx, store) => {
  const projectId = ctx.projectId;
  return {
    get_dashboard_stats: tool({
      description:
        'Get aggregate dashboard statistics for the current project. The digest includes the ' +
        'headline summary plus per-agent and per-model usage breakdowns (calls, tokens) — use it ' +
        'to chart or compare usage across agents instead of fetching each agent individually. ' +
        'The full dashboard is rendered to the user as a card.',
      parameters: empty,
      confirm: false,
      execute: async () => {
        const view = await statisticsApi.dashboard({ projectId });
        // Per-agent tokens come from the bucketed series; fold it down to one row per agent so the
        // digest stays compact while still letting the model chart usage without N follow-up reads.
        const tokensByAgent = new Map<string, { inputTokens: number; outputTokens: number }>();
        for (const bucket of view.tokenUsageByAgent) {
          const acc = tokensByAgent.get(bucket.agentId) ?? { inputTokens: 0, outputTokens: 0 };
          acc.inputTokens += bucket.inputTokens;
          acc.outputTokens += bucket.outputTokens;
          tokensByAgent.set(bucket.agentId, acc);
        }
        const callsByAgent = new Map(view.agentBreakdown.map((b) => [b.agentId, b.callCount]));
        return store('dashboard-stats', view, {
          summary: view.summary,
          byAgent: view.agents.map((agent) => ({
            id: agent.id,
            name: agent.name,
            calls: callsByAgent.get(agent.id) ?? 0,
            ...(tokensByAgent.get(agent.id) ?? { inputTokens: 0, outputTokens: 0 }),
          })),
          byModel: view.modelBreakdown.map((m) => ({
            model: m.modelName,
            calls: m.callCount,
            inputTokens: m.totalInputTokens,
            outputTokens: m.totalOutputTokens,
            avgDurationMs: m.avgDurationMs,
          })),
        });
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
  };
};
