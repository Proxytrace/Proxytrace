import {
  streamText,
  convertToModelMessages,
  tool,
  zodSchema,
  type ChatTransport,
  type UIMessage,
  type UIMessageChunk,
  type ToolSet,
} from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { getAccessToken } from '../../auth/token';
import { createTraceyTools, type TraceyToolContext } from './tracey-tools';

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
    const result = streamText({
      model: this.model,
      system: this.systemPrompt,
      messages: await convertToModelMessages(options.messages),
      tools: this.tools,
      abortSignal: options.abortSignal,
    });
    return result.toUIMessageStream();
  }

  reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
    return Promise.resolve(null);
  }
}

function buildAiTools(ctx: TraceyToolContext): ToolSet {
  const traceyTools = createTraceyTools(ctx);
  const aiTools: ToolSet = {};
  for (const [name, def] of Object.entries(traceyTools)) {
    aiTools[name] = tool({
      description: def.description,
      inputSchema: zodSchema(def.parameters),
      execute: (args: unknown) => def.execute(args as Record<string, unknown>, ctx),
    });
  }
  return aiTools;
}
