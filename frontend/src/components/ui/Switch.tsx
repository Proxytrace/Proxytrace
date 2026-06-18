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
 * Token-styled on/off switch (ARIA `role="switch"`). Provide `label` or `aria-label` for an
 * accessible name. On = the gold accent gradient; off = a recessed card-2 track. The off-state
 * outline is an inset hairline ring (a box-shadow, not a `border`) so the knob sits at the exact
 * same offset in both states — toggling slides it cleanly with no 1px jump.
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
        'relative shrink-0 w-10 h-6 rounded-full cursor-pointer',
        'transition-[background-color,box-shadow] duration-[var(--motion-base)] ease-[var(--ease-standard)]',
        FOCUS_RING,
        'disabled:opacity-50 disabled:cursor-not-allowed',
        checked
          ? 'bg-[image:var(--grad-accent)]'
          : 'bg-card-2 shadow-[inset_0_0_0_1px_var(--hairline)] hover:shadow-[inset_0_0_0_1px_var(--border-color)]',
      )}
    >
      <span
        className={cn(
          'absolute top-[3px] left-[3px] h-[18px] w-[18px] rounded-full bg-white shadow-[var(--shadow-pill)]',
          'transition-transform duration-[var(--motion-base)] ease-[var(--ease-standard)]',
          checked ? 'translate-x-[16px]' : 'translate-x-0',
        )}
      />
    </button>
  );
}
