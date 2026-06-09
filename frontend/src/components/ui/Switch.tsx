import { cn } from '../../lib/cn';
import { FOCUS_RING } from '../../lib/constants';

interface SwitchProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  label?: string;
  'aria-label'?: string;
  'data-testid'?: string;
}

/**
 * Token-styled on/off switch (ARIA `role="switch"`). Provide `label` or
 * `aria-label` for an accessible name.
 */
export function Switch({
  checked,
  onChange,
  disabled,
  label,
  'aria-label': ariaLabel,
  'data-testid': testId,
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel ?? label}
      disabled={disabled}
      data-testid={testId}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative shrink-0 w-10 h-6 rounded-full transition-colors cursor-pointer',
        FOCUS_RING,
        'disabled:opacity-50 disabled:cursor-not-allowed',
        checked ? 'bg-accent' : 'bg-card-2 border border-hairline',
      )}
    >
      <span
        className={cn(
          'absolute top-[2px] left-[2px] w-[18px] h-[18px] rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0',
        )}
      />
    </button>
  );
}
