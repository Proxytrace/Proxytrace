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
/**
 * Per-turn tool-loop step budget. Must comfortably cover the longest scripted flow (the
 * optimize-agent playbook runs ~8 steps) — when it is hit anyway, the turn ends with
 * `finishReason: 'tool-calls'` and the UI shows a step-limit notice.
 */
export const MAX_TURN_STEPS = 12;

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
    private readonly toolContext: TraceyToolContext,
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
        // The AI SDK pre-fills `Authorization: Bearer <apiKey>` from the placeholder above. Use the
        // real in-memory app JWT when we have one; otherwise DROP the header so the same-origin
        // session cookie authenticates. After a page reload the JWT is gone (it lives in memory
        // only — LocalAuthProvider restores the session from the cookie, not the token), and
        // leaving the bogus `app-jwt` bearer makes the backend reject it with 401 instead of
        // falling back to the cookie — i.e. Tracey gets no response on every post-reload turn.
        if (token) headers.set('Authorization', `Bearer ${token}`);
        else headers.delete('Authorization');
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
    // The UI keeps the full thread, but the model only gets a window of recent messages — without
    // a cap, per-turn token cost grows linearly with conversation age forever.
    const windowed = windowMessages(options.messages);
    // A skill stays loaded for the whole conversation: re-derive the loaded set from the message
    // history (load_skill results persist there, surviving reloads and thread resets) so earlier
    // turns' bundles stay unlocked and `load_skill` can answer repeat loads compactly. Derived
    // from the *windowed* messages on purpose: if a playbook has been trimmed out of the model's
    // context, the skill must count as unloaded so a reload returns the full instructions again.
    const conversationSkills = this.toolContext.loadedSkillIds;
    conversationSkills.clear();
    for (const id of skillIdsFromMessages(windowed)) conversationSkills.add(id);
    const result = streamText({
      model: this.model,
      system: this.systemPrompt,
      messages: await convertToModelMessages(windowed),
      tools: this.tools,
      // Progressive tool disclosure: every tool is defined (so the wire capture stays complete),
      // but only CORE plus the bundles of skills loaded so far this conversation are offered to
      // the model on a given step. Loading a skill via `load_skill` unlocks its tools — a
      // dispatcher feel without a second model. (See `tool-access.ts`.)
      prepareStep: ({ steps }) => {
        const activeTools = activeToolNamesFor([...conversationSkills, ...loadedSkillIds(steps)]);
        // Proactive wait, enforced: once a step has produced an `awaitable` handle the model has
        // not yet passed to `await_actions`, the next step *must* call it — prompt instructions
        // alone proved unreliable, and a turn that ends right after `start_test_run` strands the
        // user re-prompting "is it done yet?". Forcing the tool (not 'required') means the model
        // can't detour; it still authors the args, so it batches every pending handle into the
        // one call. A wrong/missed id re-forces on the next step, capped by `stopWhen`.
        if (pendingAwaitables(steps).length > 0) {
          return {
            // The producing writes are only unlocked by bundles that include `await_actions`, but
            // a forced tool must be active, so guarantee it rather than rely on that invariant.
            activeTools: activeTools.includes('await_actions') ? activeTools : [...activeTools, 'await_actions'],
            toolChoice: { type: 'tool' as const, toolName: 'await_actions' },
          };
        }
        return { activeTools };
      },
      // Without a stop condition the AI SDK ends the run after the first step, so a turn that
      // starts with a tool call produces no assistant text. Keep looping (tool → result → model)
      // until the model answers or the budget is spent. 12 covers the longest scripted flow
      // (optimize-agent: load_skill → reads → submit → await = 8 steps) with slack for a
      // disambiguation or an extra read; exhaustion is surfaced via `finishReason` below.
      stopWhen: stepCountIs(MAX_TURN_STEPS),
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
                // 'tool-calls' here means the step budget cut the loop mid-tool-use — the model
                // never got to answer. MessageStatusBar surfaces it as a step-limit notice.
                finishReason: part.finishReason,
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
 * How many recent UIMessages the model sees per turn (≈ half that many user↔assistant exchanges).
 * The UI thread is never trimmed — only what goes to the model.
 */
export const MODEL_HISTORY_WINDOW = 30;

/**
 * The slice of the conversation sent to the model: the last {@link MODEL_HISTORY_WINDOW} messages,
 * extended forward to the next **user** message so the window never opens mid-exchange (an
 * assistant tool loop must not appear without the prompt it answered). Under the cap, the full
 * history passes through untouched. Exported for unit testing.
 */
export function windowMessages(messages: UIMessage[], max: number = MODEL_HISTORY_WINDOW): UIMessage[] {
  if (messages.length <= max) return messages;
  let start = messages.length - max;
  while (start < messages.length && messages[start].role !== 'user') start++;
  // Degenerate thread with no user message in the tail: fall back to the plain slice rather than
  // sending nothing.
  if (start >= messages.length) return messages.slice(messages.length - max);
  return messages.slice(start);
}

/**
 * Skill ids loaded in earlier turns, read from the conversation's `load_skill` tool parts (calls
 * that found their skill; `notFound` results don't count). Keeps a skill's tool bundle unlocked
 * for the rest of the conversation — including after a page reload, since the restored thread
 * still carries the parts. Exported for unit testing.
 */
export function skillIdsFromMessages(messages: ReadonlyArray<UIMessage>): string[] {
  const ids: string[] = [];
  for (const message of messages) {
    for (const part of message.parts) {
      if (part.type !== 'tool-load_skill') continue;
      const { input, output } = part as { input?: unknown; output?: unknown };
      if (!input || typeof input !== 'object') continue;
      const skillId = (input as { skillId?: unknown }).skillId;
      if (typeof skillId !== 'string') continue;
      if (output && typeof output === 'object' && 'notFound' in output) continue;
      ids.push(skillId);
    }
  }
  return ids;
}

/** A long-running-action handle as produced by `start_test_run` / `submit_optimization_theory`. */
export interface AwaitableHandle {
  kind: string;
  id: string;
}

/** Reads the `awaitable` handle off a tool result, whether stored (under `summary`) or inline. */
function awaitableOf(output: unknown): AwaitableHandle | undefined {
  if (!output || typeof output !== 'object') return undefined;
  const summary = (output as { summary?: unknown }).summary;
  const handle =
    (output as { awaitable?: unknown }).awaitable ??
    (summary && typeof summary === 'object' ? (summary as { awaitable?: unknown }).awaitable : undefined);
  if (!handle || typeof handle !== 'object') return undefined;
  const { kind, id } = handle as { kind?: unknown; id?: unknown };
  return typeof kind === 'string' && typeof id === 'string' ? { kind, id } : undefined;
}

/**
 * The `awaitable` handles produced by this turn's steps that no `await_actions` call has waited
 * on yet. While any are pending, `prepareStep` forces the next step to be an `await_actions` call
 * so a long-running action is always followed up in the same turn — the model can't end the turn
 * with "the run has started" and leave the user to re-prompt for the outcome. Cancelled or
 * not-found writes return no handle, so they never force a wait. Exported for unit testing.
 */
export function pendingAwaitables(steps: ReadonlyArray<StepResult<ToolSet>>): AwaitableHandle[] {
  // Keyed by `kind:id`, not id alone, so a handle is only considered satisfied by an
  // `await_actions` call on a handle of the same kind — matching the keys the cards and tests use.
  const keyOf = (h: AwaitableHandle): string => `${h.kind}:${h.id}`;
  const produced: AwaitableHandle[] = [];
  const awaited = new Set<string>();
  for (const step of steps) {
    for (const result of step.toolResults) {
      const handle = awaitableOf(result.output);
      if (handle) produced.push(handle);
    }
    for (const call of step.toolCalls) {
      if (call.toolName !== 'await_actions') continue;
      const handles = (call.input as { handles?: unknown }).handles;
      if (!Array.isArray(handles)) continue;
      for (const h of handles) {
        const { kind, id } = (h as { kind?: unknown; id?: unknown } | null) ?? {};
        if (typeof kind === 'string' && typeof id === 'string') awaited.add(keyOf({ kind, id }));
      }
    }
  }
  return produced.filter((h) => !awaited.has(keyOf(h)));
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
          // The SDK's abort signal (user hit Stop) rides along so long-running tools can cancel.
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
