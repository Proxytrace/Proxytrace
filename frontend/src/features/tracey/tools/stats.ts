import { z } from 'zod';
import { statisticsApi } from '../../../api/statistics';
import { type ToolFactory, tool, empty } from './shared';

export const createStatsTools: ToolFactory = (ctx, store) => {
  const projectId = ctx.projectId;
  return {
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
  };
};
