import { z } from 'zod';
import { agentsApi } from '../../../api/agents';
import { proposalsApi } from '../../../api/proposals';
import { theoriesApi } from '../../../api/theories';
import { Priority, ProposalStatus, TheorySource } from '../../../api/models';
import { type ToolFactory, tool, empty, CANCELLED } from './shared';

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

export const createProposalTools: ToolFactory = (ctx, store) => {
  const projectId = ctx.projectId;
  return {
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
  };
};
