import { agentColor } from '../../lib/colors';

/** Two-letter initials from a name or email: first+last word, or first two chars. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Stable color for a project/member avatar, hashed from its id. Delegates to the shared
 * categorical avatar palette in `lib/colors.ts` (`agentColor` / `AGENT_PALETTE`) — the single
 * source of truth for per-entity hues (8 mutually-distinct, DESIGN.md §2.1 brand-derived
 * colors) — so unrelated projects and members no longer collapse onto a near-identical hue.
 * Returns a raw hex color (the palette's contract); `Avatar` mixes it into its gradient fill.
 */
export function colorFor(id: string): string {
  return agentColor(id);
}

/** "Provider · Model" for an endpoint id, or the raw id when not found. */
export function endpointLabel(
  endpoints: { id: string; providerName: string; modelName: string }[],
  endpointId: string,
): string {
  const ep = endpoints.find(e => e.id === endpointId);
  return ep ? `${ep.providerName} · ${ep.modelName}` : endpointId;
}
