import { cn } from '../../lib/cn';

export const formInputCls = cn(
  'w-full px-3 py-2 bg-card-2 border border-border rounded-md',
  'text-title text-primary font-[inherit] outline-none',
  'transition-[border-color,box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-standard)]',
  'focus:border-accent focus:ring-1 focus:ring-[color-mix(in_srgb,var(--accent-primary)_45%,transparent)]',
  'disabled:opacity-50 disabled:cursor-not-allowed',
  'data-[invalid=true]:border-danger data-[invalid=true]:focus:ring-[color-mix(in_srgb,var(--danger)_45%,transparent)]',
);