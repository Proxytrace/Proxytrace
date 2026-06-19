import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import { ToolCallCard } from '../ToolCallCard';

/**
 * Whether a read tool's call opted into a full card. The model sets `present: true` in the tool
 * args only when showing the card *is* the answer; absent/false/streaming args mean "stay quiet".
 * Pure so it can be unit-tested without rendering.
 */
export function isPresented(args: unknown): boolean {
  return !!args && typeof args === 'object' && (args as { present?: unknown }).present === true;
}

/**
 * Wraps a rich tool-UI card so it only renders when the model opted in via `present: true`.
 * Otherwise the call collapses to the slim, expandable {@link ToolCallCard} — the same quiet trace
 * row `navigate` already uses — so intermediate reads the model did for its own reasoning don't
 * spam the thread, while staying auditable. Applied per-entry in the registry, so the same card
 * component can be gated for a read (`get_suite`) yet always-on for a write (`create_suite`).
 */
export const presentGate =
  (Card: ToolCallMessagePartComponent): ToolCallMessagePartComponent =>
  (props) => (isPresented(props.args) ? <Card {...props} /> : <ToolCallCard {...props} />);
