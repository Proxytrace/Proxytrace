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

/**
 * Optional flag a *read* tool exposes so the model controls whether its result renders as a full
 * card. Default (omitted/false): the call collapses to a quiet, expandable one-line trace, keeping
 * intermediate reads out of the user's way. The model sets it `true` only when showing the card
 * *is* the answer. Purely presentational — `execute` ignores it (the digest the model receives is
 * identical either way); the registry's `presentGate` reads it at render time (see
 * `components/tool-ui/present-gate.tsx`). Spread into a gated tool's schema:
 * `z.object({ present: presentArg, … })`. The wire description stays terse on purpose — the
 * prompt's "card economy" rules carry the full when-to-present nuance.
 */
export const presentArg = z.boolean().optional().describe(
  'Render this result as a card for the user. Default false: a quiet one-line trace. Set true only ' +
  'when this card is the answer the user asked to see — never for intermediate reads.',
);

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
 * Run a by-id read, resolving `undefined` when the API answers 404 (deleted entity, stale or
 * mistyped id). Pair with `silentStatuses: [404]` on the API call so no error toast fires; the
 * tool then answers the model with a compact `{ notFound: id }` it can recover from (re-list,
 * ask the user) instead of an opaque thrown error.
 */
export async function ignore404<T>(read: () => Promise<T>): Promise<T | undefined> {
  try {
    return await read();
  } catch (error) {
    if ((error as { status?: number }).status === 404) return undefined;
    throw error;
  }
}

/**
 * Canonical GUID shape — what every Proxytrace entity id is. The model sometimes passes a *name*
 * where an id is required (e.g. an `agentId` filter set to "tracey"). For by-id GETs that hit a
 * `{id:guid}` route a non-id just 404s (handled by {@link ignore404}), but an id-typed *query
 * filter* binds to `[FromQuery] Guid?` and a non-GUID trips a raw 400 + error toast before the
 * action runs. Guard such filters with this and short-circuit to a graceful `{ notFound }` instead.
 */
const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isEntityId = (value: string): boolean => GUID_RE.test(value.trim());

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
