import { z } from 'zod';
import { agentsApi } from '../../../api/agents';
import { type ToolFactory, tool, presentArg, includeSystemArg, ignore404, listDigest } from './shared';

export const createAgentTools: ToolFactory = (ctx, store) => {
  const projectId = ctx.projectId;
  return {
    list_agents: tool({
      description:
        'List the agents in the current project. Returns a compact index (each agent\'s id, name, ' +
        'model endpoint, tool count) plus a reference; the full list is rendered to the user as a ' +
        'card. Use this index directly — only call get_agent when the user asks about one ' +
        'specific agent in detail. Hides internal system agents (Tracey, evaluators) unless ' +
        'includeSystem is true.',
      parameters: z.object({ present: presentArg, includeSystem: includeSystemArg }),
      confirm: false,
      execute: async ({ includeSystem }) => {
        const all = (await agentsApi.list({ projectId })).items;
        const items = includeSystem ? all : all.filter((a) => !a.isSystemAgent);
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
      parameters: z.object({
        present: presentArg,
        agentId: z.string().describe(
          'The id of the agent to fetch — an id from list_agents, NOT the agent\'s name. ' +
          'If you only have a name, call list_agents first and use the matching row\'s id.',
        ),
      }),
      confirm: false,
      execute: async ({ agentId }) => {
        const agent = await ignore404(() => agentsApi.get(agentId, { silentStatuses: [404] }));
        if (!agent) return { notFound: agentId };
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
