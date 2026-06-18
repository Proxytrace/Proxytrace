import type { CSSProperties } from 'react';

/**
 * Canonical selected-row treatment for the master-detail list rails (agents, suites,
 * runs, playground evaluators): an entity-colored gradient wash + inset ring + soft
 * drop shadow. `color` is a runtime value resolved from `lib/colors.ts` (a hex or
 * `rgba(...)`), so it must be an inline `style` per DESIGN.md §6 — pair it with the
 * 3px left bar (`selectionBarStyle`). Locked in DESIGN.md "List rail" pattern.
 */
export function selectionRowStyle(color: string): CSSProperties {
  return {
    background: `linear-gradient(120deg, color-mix(in srgb, ${color} 10%, transparent), transparent 70%), var(--bg-card)`,
    boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 45%, transparent), 0 6px 22px -10px color-mix(in srgb, ${color} 32%, transparent)`,
  };
}

/** Fill for the 3px left accent bar of a selected row. */
export function selectionBarStyle(color: string): CSSProperties {
  return { background: color };
}

/**
 * Inactive-row classes. Rows sit inside the `bg-card` rail shell now, so they are
 * transparent at rest and only wash to `bg-card-2` on hover — no per-row shadow
 * (the shell owns elevation).
 */
export const SELECTION_ROW_INACTIVE = 'bg-transparent hover:bg-card-2';
