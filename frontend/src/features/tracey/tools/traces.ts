import { z } from 'zod';
import { agentCallsApi } from '../../../api/agent-calls';
import { type ToolFactory, tool } from './shared';

export const createTraceTools: ToolFactory = (_ctx, store) => ({
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
});
