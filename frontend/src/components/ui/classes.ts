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