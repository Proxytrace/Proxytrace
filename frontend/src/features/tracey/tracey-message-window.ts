/**
 * Pure per-turn message helpers for {@link TraceyTransport}: windowing the history sent to the
 * model, deriving the loaded-skill set from the conversation, and tracking the long-running
 * `awaitable` handles that force a same-turn `await_actions` call. All exported for unit testing;
 * no React, no I/O.
 */

import type { StepResult, ToolSet, UIMessage } from 'ai';

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
      // A handle counts as awaited only when the `await_actions` call actually *resolved* —
      // `toolResults`, not `toolCalls`. An errored wait (invalid input, unexpected throw) has a
      // call but no result; keying off calls let it silently satisfy the enforcement, and the
      // model could end the turn without ever delivering the outcome. Now it re-forces instead.
      if (result.toolName !== 'await_actions') continue;
      const handles = (result.input as { handles?: unknown } | null)?.handles;
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
