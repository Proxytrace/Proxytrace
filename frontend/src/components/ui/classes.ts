import { cn } from '../../lib/cn';

export const formInputCls = cn(
  'w-full px-3 py-2 bg-card-2 border border-border rounded-md',
  'text-title text-primary font-[inherit] outline-none',
  'transition-[border-color,box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-standard)]',
  'focus:border-accent focus:ring-1 focus:ring-[color-mix(in_srgb,var(--accent-primary)_45%,transparent)]',
  'disabled:opacity-50 disabled:cursor-not-allowed',
  'data-[invalid=true]:border-danger data-[invalid=true]:focus:ring-[color-mix(in_srgb,var(--danger)_45%,transparent)]',
);

/**
 * Top-right overlay control revealed on hover/focus of a `group` parent.
 * Used for the per-message copy button in trace detail blocks.
 */
export const hoverRevealOverlayCls = cn(
  'absolute top-1.5 right-2 z-10',
  'opacity-0 transition-opacity duration-[var(--motion-fast)] ease-[var(--ease-standard)]',
  'group-hover:opacity-100 focus-visible:opacity-100',
);

/** Canonical form-field label (uppercase eyebrow). Shared by `Label` + `FormField`. */
export const fieldLabelCls = 'text-caption font-semibold text-muted uppercase tracking-[0.05em]';

/** Signal Desk eyebrow: mono, uppercase, tracked — table headers, KPI labels, rail counts. */
export const EYEBROW_CLS = cn('font-mono text-caption uppercase tracking-[0.14em] text-secondary');

/** Faint accent wash on hover for interactive rows/cards (trace rows, fleet rows, list rows). */
export const hoverAccentWashCls = 'hover:bg-[color-mix(in_srgb,var(--accent-primary)_4%,transparent)]';

/** Canonical `<kbd>` key cap for keyboard hints (slash menu, palettes, shortcut legends). */
export const kbdCls = cn(
  'rounded-sm border border-hairline bg-card px-1 py-px font-mono text-caption text-secondary shadow-[var(--shadow-pill)]',
);