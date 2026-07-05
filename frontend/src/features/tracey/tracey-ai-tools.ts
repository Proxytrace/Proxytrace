import { tool, zodSchema, type ToolSet } from 'ai';
import { createTraceyTools, type TraceyToolContext } from './tracey-tools';

/**
 * Adapts our domain tool factories ({@link createTraceyTools}) into the AI SDK {@link ToolSet}.
 * A tool with no `execute` is a frontend (human-in-the-loop) tool: the SDK emits the call and
 * pauses, and the tool UI supplies the result via `addResult` (see `ask_questions`). For executable
 * tools the SDK's abort signal (user hit Stop) is threaded into `execute` so long-running tools can
 * cancel.
 */
export function buildAiTools(ctx: TraceyToolContext): ToolSet {
  const traceyTools = createTraceyTools(ctx);
  const aiTools: ToolSet = {};
  for (const [name, def] of Object.entries(traceyTools)) {
    const exec = def.execute;
    aiTools[name] = exec
      ? tool({
          description: def.description,
          inputSchema: zodSchema(def.parameters),
          execute: (args: unknown, options) =>
            exec(args as Record<string, unknown>, ctx, options.abortSignal),
        })
      : tool({
          description: def.description,
          inputSchema: zodSchema(def.parameters),
        });
  }
  return aiTools;
}
