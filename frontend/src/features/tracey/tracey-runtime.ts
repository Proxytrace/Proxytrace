import {
  streamText,
  convertToModelMessages,
  stepCountIs,
  tool,
  zodSchema,
  type ChatTransport,
  type StepResult,
  type UIMessage,
  type UIMessageChunk,
  type ToolSet,
} from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { getAccessToken } from '../../auth/token';
import { createTraceyTools, type TraceyToolContext } from './tracey-tools';
import { activeToolNamesFor } from './tool-access';

/**
 * A client-side {@link ChatTransport} that talks to Tracey's same-origin API endpoint
 * (`/api/tracey/{projectId}/openai/v1`). The API forwards each call to the project's provider and
 * captures it as an AgentCall attributed to the Tracey agent. Auth is the app's own JWT (injected
 * per request), so there is no CORS and no short-lived key. Tools execute in the browser via
 * {@link createTraceyTools}.
 */
export class TraceyTransport implements ChatTransport<UIMessage> {
  private readonly tools: ToolSet;
  private readonly model;
  /**
   * Correlation id for the in-flight turn. Sent on every upstream request of the turn so all of
   * its captured calls share one ConversationId, and attached to the assistant message's metadata
   * so the UI can deep-link the response to its ingested trace. Set per `sendMessages` call (which
   * the runtime awaits sequentially), so there's no cross-turn interleaving.
   */
  private currentTurnId: string | null = null;

  constructor(
    projectId: string,
    model: string,
    toolContext: TraceyToolContext,
    private readonly systemPrompt: string,
  ) {
    const openai = createOpenAI({
      // Relative URL → resolved against the app origin → same-origin (Vite/nginx proxies /api).
      baseURL: `/api/tracey/${projectId}/openai/v1`,
      // The real credential is the app JWT, injected by the custom fetch below; this is a placeholder.
      apiKey: 'app-jwt',
      fetch: async (input, init) => {
        const token = getAccessToken();
        const headers = new Headers(init?.headers);
        if (token) headers.set('Authorization', `Bearer ${token}`);
        if (this.currentTurnId) headers.set('x-proxytrace-session-id', this.currentTurnId);
        return fetch(input, { ...init, headers });
      },
    });
    // Chat Completions API (/chat/completions) — the default openai(id) targets the Responses API.
    this.model = openai.chat(model);
    this.tools = buildAiTools(toolContext);
  }

  async sendMessages(
    options: Parameters<ChatTransport<UIMessage>['sendMessages']>[0],
  ): Promise<ReadableStream<UIMessageChunk>> {
    // One id per turn: tags the turn's upstream calls (header, above) and the resulting assistant
    // message (metadata, below) with the same value so the UI can resolve the response → trace.
    const turnId = crypto.randomUUID();
    this.currentTurnId = turnId;
    const startedAt = performance.now();
    const result = streamText({
      model: this.model,
      system: this.systemPrompt,
      messages: await convertToModelMessages(options.messages),
      tools: this.tools,
      // Progressive tool disclosure: every tool is defined (so the wire capture stays complete),
      // but only CORE plus the bundles of skills loaded so far this turn are offered to the model
      // on a given step. Loading a skill via `load_skill` unlocks its tools for the rest of the
      // turn — a dispatcher feel without a second model. (See `tool-access.ts`.)
      prepareStep: ({ steps }) => ({ activeTools: activeToolNamesFor(loadedSkillIds(steps)) }),
      // Without a stop condition the AI SDK ends the run after the first step, so a turn that
      // starts with a tool call produces no assistant text. Keep looping (tool → result → model)
      // until the model answers or the budget is spent.
      stopWhen: stepCountIs(8),
      abortSignal: options.abortSignal,
    });
    // On finish, attach the turn's correlation id, token usage, and wall-clock duration to the
    // assistant message. assistant-ui surfaces these under `metadata.custom`; `MessageStatusBar`
    // shows them and uses the id to deep-link to the captured trace(s). `part.totalUsage` is the
    // SDK's usage aggregated across all tool-loop steps — i.e. the whole turn — which matches the
    // sum of the turn's ingested traces. Emitted only on finish, so the row stays hidden while the
    // turn is still streaming.
    return result.toUIMessageStream({
      messageMetadata: ({ part }) =>
        part.type === 'finish'
          ? {
              custom: {
                traceConversationId: turnId,
                usage: {
                  inputTokens: part.totalUsage.inputTokens ?? 0,
                  outputTokens: part.totalUsage.outputTokens ?? 0,
                  totalTokens: part.totalUsage.totalTokens ?? 0,
                },
                durationMs: Math.round(performance.now() - startedAt),
              },
            }
          : undefined,
    });
  }

  reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
    return Promise.resolve(null);
  }
}

/**
 * Skill ids loaded so far this turn, read from prior steps' `load_skill` tool calls. Drives which
 * tool bundles are active on the next step (see `prepareStep`). Exported for unit testing.
 */
export function loadedSkillIds(steps: ReadonlyArray<StepResult<ToolSet>>): string[] {
  const ids: string[] = [];
  for (const step of steps) {
    for (const call of step.toolCalls) {
      if (call.toolName !== 'load_skill') continue;
      const skillId = (call.input as { skillId?: unknown }).skillId;
      if (typeof skillId === 'string') ids.push(skillId);
    }
  }
  return ids;
}

function buildAiTools(ctx: TraceyToolContext): ToolSet {
  const traceyTools = createTraceyTools(ctx);
  const aiTools: ToolSet = {};
  for (const [name, def] of Object.entries(traceyTools)) {
    const exec = def.execute;
    // A tool with no `execute` is a frontend (human-in-the-loop) tool: the SDK emits the call and
    // pauses, and the tool UI supplies the result via `addResult` (see `ask_questions`).
    aiTools[name] = exec
      ? tool({
          description: def.description,
          inputSchema: zodSchema(def.parameters),
          execute: (args: unknown) => exec(args as Record<string, unknown>, ctx),
        })
      : tool({
          description: def.description,
          inputSchema: zodSchema(def.parameters),
        });
  }
  return aiTools;
}
