import { cn } from '../../lib/cn';

export type StatTone = 'info' | 'success' | 'warn' | 'accent';

/* eslint-disable lingui/no-unlocalized-strings -- Tailwind class recipes, not user-facing copy */
/** Tone → icon chip classes: subtle fill + inset ring + icon text color. */
const TONE_ICON: Record<StatTone, string> = {
  info: 'bg-[color-mix(in_srgb,var(--teal)_14%,transparent)] ring-[color-mix(in_srgb,var(--teal)_32%,transparent)] text-[var(--teal)]',
  success: 'bg-[color-mix(in_srgb,var(--success)_14%,transparent)] ring-[color-mix(in_srgb,var(--success)_32%,transparent)] text-[var(--success)]',
  warn: 'bg-[color-mix(in_srgb,var(--warn)_14%,transparent)] ring-[color-mix(in_srgb,var(--warn)_32%,transparent)] text-[var(--warn)]',
  accent: 'bg-[color-mix(in_srgb,var(--accent-primary)_14%,transparent)] ring-[color-mix(in_srgb,var(--accent-primary)_32%,transparent)] text-[var(--accent-primary)]',
};

/** Tone → value text color (overrides the default primary). */
const TONE_VALUE_TEXT: Record<StatTone, string> = {
  info: 'text-[var(--teal)]',
  success: 'text-[var(--success)]',
  warn: 'text-[var(--warn)]',
  accent: 'text-[var(--accent-primary)]',
};
/* eslint-enable lingui/no-unlocalized-strings */

interface DrawerStatProps {
  label: string;
  value?: string;
  sub?: React.ReactNode;
  icon: React.ReactNode;
  tone: StatTone;
  valueTone?: StatTone;
  children?: React.ReactNode;
  valueTestId?: string;
}

export function DrawerStat({ label, value, sub, icon, tone, valueTone, children, valueTestId }: DrawerStatProps) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2.5">
        <div className={cn('w-9 h-9 rounded-md flex items-center justify-center shrink-0 ring-1 ring-inset', TONE_ICON[tone])}>
          {icon}
        </div>
        <div className="min-w-0 leading-tight">
          <div className="text-caption text-muted font-medium tracking-[0.05em] uppercase">{label}</div>
          {value !== undefined && (
            <div data-testid={valueTestId} className={cn('text-h1 font-bold mt-0.5 font-mono', valueTone ? TONE_VALUE_TEXT[valueTone] : 'text-primary')}>
              {value}
            </div>
          )}
          {children}
        </div>
      </div>
      {sub && <div className="text-caption text-muted mt-1 ml-[46px]">{sub}</div>}
    </div>
  );
}
