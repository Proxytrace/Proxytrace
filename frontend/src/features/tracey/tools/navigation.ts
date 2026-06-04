import { z } from 'zod';
import { searchDocs } from '../knowledge/search-docs';
import { DOCS_INDEX } from '../knowledge/docs-index.generated';
import { getSkill, listSkills } from '../skills/registry';
import { type ToolFactory, tool } from './shared';

export const createNavigationTools: ToolFactory = (ctx) => ({
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
});
