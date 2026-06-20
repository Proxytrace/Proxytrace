import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { FOCUS_RING } from '../../lib/constants';

export interface Segment<T extends string> {
  value: T;
  /** Text label. Omit for an icon-only segment (then `icon` + `ariaLabel` are required). */
  label?: string;
  icon?: ReactNode;
  count?: number;
  ariaLabel?: string;
}

interface Props<T extends string> {
  value: T;
  onChange: (value: T) => void;
  segments: Segment<T>[];
  className?: string;
}

/**
 * Pill-style segmented control for view toggles and compact filter switches.
 * Supports text segments with optional counts and icon-only segments.
 */
export function SegmentedControl<T extends string>({ value, onChange, segments, className }: Props<T>) {
  return (
    <div className={`flex gap-0.5 p-0.5 bg-card-2 rounded-lg ${className ?? ''}`}>
      {segments.map(seg => {
        const active = seg.value === value;
        const iconOnly = seg.label === undefined;
        const stateCls = active
          ? cn('bg-card text-primary shadow-[var(--shadow-pill)]')
          : cn('text-muted hover:text-secondary');
        return (
          <button
            key={seg.value}
            type="button"
            onClick={() => onChange(seg.value)}
            aria-pressed={active}
            aria-label={seg.ariaLabel}
            className={`rounded-md cursor-pointer font-medium whitespace-nowrap transition-colors duration-[var(--motion-fast)] ${FOCUS_RING} ${stateCls} ${
              iconOnly ? 'w-[26px] h-[26px] flex items-center justify-center' : 'px-2.5 py-1 text-body-sm'
            }`}
          >
            {seg.icon}
            {seg.label}
            {seg.count != null && <span className="mono text-caption opacity-70"> {seg.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
