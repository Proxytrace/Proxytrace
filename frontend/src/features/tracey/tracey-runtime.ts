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
import type { TraceySessionDto } from '../../api/tracey';
import { createTraceyTools, type TraceyToolContext } from './tracey-tools';

/**
 * A client-side {@link ChatTransport} that talks directly to Proxytrace's OpenAI-compatible
 * proxy with the short-lived session key. Each reasoning step runs through the proxy and is
 * captured as an AgentCall attributed to the project's Tracey agent. Tools execute in the
 * browser via {@link createTraceyTools}.
 */
export class TraceyTransport implements ChatTransport<UIMessage> {
  private readonly tools: ToolSet;
  private readonly model;

  constructor(
    session: TraceySessionDto,
    toolContext: TraceyToolContext,
    private readonly systemPrompt: string,
  ) {
    const openai = createOpenAI({
      baseURL: session.proxyBaseUrl,
      apiKey: session.apiKey,
    });
    // Use the Chat Completions API (/chat/completions) — that is what the Proxytrace proxy
    // speaks. The provider default (openai(id)) targets the Responses API (/responses),
    // which the proxy does not expose.
    this.model = openai.chat(session.model);
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
