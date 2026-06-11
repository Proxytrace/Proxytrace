import { z } from 'zod';
import { storeArtifact } from '../tracey-artifact-store';
import type { ArtifactKind, ArtifactPayloads } from '../tracey-artifact-kinds';

/**
 * Runtime context the Tracey tools execute against. Read tools call the typed `src/api`
 * services; `navigate` performs a client-side route change; `confirm` gates write tools
 * (auto-approve resolves it to `true` without prompting).
 */
export interface TraceyToolContext {
  projectId?: string;
  /**
   * `${userKey}:${projectKey}` scope under which large tool payloads are stored in the artifact
   * store, so a thread reset can wipe exactly this user+project's blobs.
   */
  artifactScope: string;
  navigate: (path: string) => void;
  /** Resolves `true` to proceed with a write, `false` to cancel. */
  confirm: (summary: string) => Promise<boolean>;
  /**
   * Skill ids loaded in this conversation. The transport re-derives it from the message history
   * at the start of every turn (so it survives reload and resets with the thread); `load_skill`
   * adds to it mid-turn and uses it to answer repeat loads with a compact "already loaded"
   * instead of the full playbook.
   */
  loadedSkillIds: Set<string>;
}

/**
 * A single Tracey tool. `parameters` is a zod schema (the AI runtime turns it into a JSON
 * schema); `execute` runs client-side. This is the sole source of truth for Tracey's tool set:
 * the backend stores no copy — it captures the prompt + tools from the wire on her first call
 * and versions them under her name-attributed agent.
 */
export interface TraceyTool<TArgs = Record<string, unknown>> {
  description: string;
  parameters: z.ZodType<TArgs>;
  /** Whether this tool mutates state and must be confirmed when auto-approve is off. */
  confirm: boolean;
  /**
   * Runs the tool client-side. Omitted for human-in-the-loop tools (e.g. `ask_questions`)
   * whose UI supplies the result via assistant-ui's `addResult`, pausing the turn until the
   * user responds instead of resolving immediately. `signal` aborts when the user stops the
   * turn — long-running tools (`await_actions`) must honor it.
   */
  execute?: (args: TArgs, ctx: TraceyToolContext, signal?: AbortSignal) => Promise<unknown>;
}

/** Parameter schema for tools that take no arguments. */
export const empty = z.object({});

/** Result a write tool returns when the user declines the confirmation. */
export const CANCELLED = { cancelled: true } as const;

/**
 * Stash a large payload in the browser artifact store and hand the model only a compact
 * reference + digest. The inline tool-UI card resolves the reference back to the full data, so
 * the rich result reaches the user without ever entering the model context. The store itself
 * falls back from IndexedDB to localStorage; only if both are unavailable do we return the full
 * payload inline — the card renders it either way, and only that last-resort mode costs context.
 *
 * The payload type is bound to the artifact `kind` via {@link ArtifactPayloads}, so a tool can
 * only store the shape its card reads back via `useArtifactResult(kind, …)`.
 */
export type StoreFn = <K extends ArtifactKind, S>(
  kind: K,
  full: ArtifactPayloads[K],
  summary: S,
) => Promise<unknown>;

/** Per-domain tool factory: builds the tools for one domain against a shared store + context. */
export type ToolFactory = (ctx: TraceyToolContext, store: StoreFn) => Record<string, TraceyTool>;

/** Identity-cast helper so a typed `TraceyTool<TArgs>` can sit in a `Record<string, TraceyTool>`. */
export const tool = <TArgs>(t: TraceyTool<TArgs>): TraceyTool => t as unknown as TraceyTool;

/**
 * Build a capped list digest for the model: the total count, the first `max` mapped rows, and —
 * only when rows were dropped — a note telling the model the user's card still shows everything.
 * Every `list_*` digest goes through this so a large project can't flood the context.
 */
export function listDigest<T, R>(items: T[], max: number, map: (item: T) => R) {
  return {
    count: items.length,
    items: items.slice(0, max).map(map),
    ...(items.length > max
      ? { note: `Digest shows the first ${max} of ${items.length}; the user sees the full list.` }
      : {}),
  };
}

/** Build the artifact-store helper bound to a context, swallowing storage errors back to inline. */
export function makeStore(ctx: TraceyToolContext): StoreFn {
  return async (kind, full, summary) => {
    try {
      return await storeArtifact(ctx.artifactScope, kind, full, summary);
    } catch {
      return full;
    }
  };
}
