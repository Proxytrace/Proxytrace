import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { FOCUS_RING } from '../../lib/constants';

export type SwitchPillSize = 'sm' | 'md';

interface SwitchPillProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  /** Inline label rendered beside the track. Localize at the call site (e.g. `<Trans>`). */
  label?: ReactNode;
  size?: SwitchPillSize;
  title?: string;
  'aria-label'?: string;
  'data-testid'?: string;
}

/* eslint-disable lingui/no-unlocalized-strings -- Tailwind size classes, not user-facing copy */
const SIZE_CLS: Record<SwitchPillSize, string> = {
  sm: 'h-8 px-2.5 gap-1.5 text-body-sm',
  md: 'h-9 px-3 gap-2 text-body',
};
/* eslint-enable lingui/no-unlocalized-strings */

/**
 * Labeled switch-pill: a `role="switch"` control that fuses a small rounded track + sliding white
 * thumb with an inline label inside one tinted pill. Unlike the plain `Switch` primitive, the label
 * lives *inside* the control, so a toolbar / footer toggle reads as a single pill. On = accent-subtle
 * wash + gold track; off = recessed card wash. Motion respects `prefers-reduced-motion`.
 */
export function SwitchPill({
  checked,
  onChange,
  label,
  size = 'md',
  title,
  'aria-label': ariaLabel,
  'data-testid': testId,
}: SwitchPillProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      data-testid={testId}
      onClick={() => onChange(!checked)}
      title={title}
      className={cn(
        'inline-flex items-center rounded-md font-medium cursor-pointer border-none',
        'transition-colors duration-[var(--motion-base)] ease-[var(--ease-standard)] motion-reduce:transition-none',
        FOCUS_RING,
        SIZE_CLS[size],
        checked
          ? 'text-accent bg-accent-subtle shadow-[0_0_0_1px_var(--accent-primary),var(--shadow-pill)]'
          : 'text-secondary bg-card shadow-[var(--shadow-pill)]',
      )}
    >
      <span
        className={cn(
          'w-7 h-4 rounded-none relative transition-colors duration-[var(--motion-base)] ease-[var(--ease-standard)] motion-reduce:transition-none',
          checked ? 'bg-accent' : 'bg-white/[0.12]',
        )}
        aria-hidden="true"
      >
        <span
          className={cn(
            'absolute top-[2px] w-3 h-3 rounded-none bg-white transition-[left] duration-[var(--motion-base)] ease-[var(--ease-standard)] motion-reduce:transition-none',
            checked ? 'left-[14px]' : 'left-[2px]',
          )}
        />
      </span>
      {label}
    </button>
  );
}
