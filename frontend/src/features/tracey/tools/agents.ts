import { z } from 'zod';
import { agentsApi } from '../../../api/agents';
import { type ToolFactory, tool, empty, listDigest } from './shared';

export const createAgentTools: ToolFactory = (ctx, store) => {
  const projectId = ctx.projectId;
  return {
    list_agents: tool({
      description:
        'List the agents in the current project. Returns a compact index (each agent\'s id, name, ' +
        'model endpoint, tool count) plus a reference; the full list is rendered to the user as a ' +
        'card. Use this index directly — only call get_agent when the user asks about one ' +
        'specific agent in detail.',
      parameters: empty,
      confirm: false,
      execute: async () => {
        const items = (await agentsApi.list({ projectId })).items;
        return store('agent-list', items, listDigest(items, 25, (a) => ({
          id: a.id,
          name: a.name,
          endpointName: a.endpointName,
          toolCount: a.toolCount,
        })));
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
  };
};
