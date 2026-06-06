import { z } from 'zod';
import { agentsApi } from '../../../api/agents';
import { type ToolFactory, tool, empty } from './shared';

export const createAgentTools: ToolFactory = (ctx, store) => {
  const projectId = ctx.projectId;
  return {
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
  };
};
