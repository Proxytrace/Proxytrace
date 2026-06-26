import type { ReactNode } from 'react';
import { cn } from '../../../lib/cn';

interface Props {
  checked: boolean;
  onChange: (value: boolean) => void;
  title: string;
  label: ReactNode;
  testId?: string;
}

/**
 * Bespoke labeled switch-pill used in the Traces toolbar (track + inline label in one tinted
 * control). Not the generic `Switch` primitive — the toolbar wants the label fused into the pill.
 */
export function FilterTogglePill({ checked, onChange, title, label, testId }: Props) {
  return (
    // eslint-disable-next-line no-restricted-syntax -- bespoke labeled switch-pill (track + inline label in one tinted control)
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-testid={testId}
      onClick={() => onChange(!checked)}
      title={title}
      className={cn(
        'inline-flex items-center gap-2 h-9 px-3 rounded-[10px] text-[12.5px] font-medium cursor-pointer transition-colors duration-200 border-none',
        checked ? 'text-accent bg-accent-subtle' : 'text-secondary bg-card',
      )}
      style={{
        boxShadow: checked
          ? '0 0 0 1px var(--accent-primary), var(--shadow-pill)'
          : 'var(--shadow-pill)',
      }}
    >
      <span
        className={cn('w-7 h-4 rounded-full relative transition-colors duration-200', checked ? 'bg-accent' : 'bg-[rgba(255,255,255,0.12)]')}
        aria-hidden="true"
      >
        <span
          className="absolute top-[2px] w-3 h-3 rounded-full bg-white transition-[left] duration-200"
          style={{ left: checked ? '14px' : '2px' }}
        />
      </span>
      {label}
    </button>
  );
}
