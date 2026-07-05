/**
 * Barrel for Tracey's chat runtime, kept so consumers import from one place while the
 * implementation is split across cohesive modules:
 * - {@link ./tracey-transport} — the `TraceyTransport` `ChatTransport` + `MAX_TURN_STEPS`.
 * - {@link ./tracey-message-window} — the pure per-turn helpers (history windowing, loaded-skill
 *   derivation, `awaitable` tracking) that the transport composes.
 * - {@link ./tracey-ai-tools} — the AI SDK `ToolSet` adapter.
 */

export { TraceyTransport, MAX_TURN_STEPS } from './tracey-transport';
export {
  MODEL_HISTORY_WINDOW,
  windowMessages,
  skillIdsFromMessages,
  pendingAwaitables,
  loadedSkillIds,
  type AwaitableHandle,
} from './tracey-message-window';
