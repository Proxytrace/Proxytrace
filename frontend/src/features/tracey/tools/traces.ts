import { z } from 'zod';
import { agentCallsApi } from '../../../api/agent-calls';
import { type ToolFactory, tool } from './shared';
import { clip } from './run-analysis';

export const createTraceTools: ToolFactory = (ctx, store) => ({
  find_traces: tool({
    description:
      'Search the captured traces (real LLM calls) of this project — by agent, free-text query, ' +
      'or HTTP status — newest first. Use it to ground a tuning hypothesis in what the agent ' +
      'actually said: find failing or suspicious calls, then `get_trace` one for full detail. ' +
      'The matching traces are rendered to the user as a card.',
    parameters: z.object({
      agentId: z.string().optional().describe('Only traces of this agent.'),
      query: z.string().optional().describe('Free-text search over the captured request/response.'),
      httpStatus: z.number().int().optional()
        .describe('Only calls with this exact upstream HTTP status (e.g. 500 for errors).'),
      limit: z.number().int().min(1).max(20).optional().describe('Max traces to return (default 10).'),
    }),
    confirm: false,
    execute: async ({ agentId, query, httpStatus, limit }) => {
      const { items } = await agentCallsApi.list({
        projectId: ctx.projectId,
        agentId,
        q: query,
        httpStatus,
        pageSize: limit ?? 10,
      });
      return store('trace-list', items, {
        count: items.length,
        items: items.map((t) => ({
          id: t.id,
          agentName: t.agentName,
          model: t.model,
          httpStatus: t.httpStatus,
          ...(t.errorMessage ? { error: clip(t.errorMessage, 120) } : {}),
          durationMs: t.durationMs,
          tokens: t.inputTokens + t.outputTokens,
          preview: t.messagePreview ? clip(t.messagePreview, 100) : null,
          createdAt: t.createdAt,
        })),
      });
    },
  }),
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
