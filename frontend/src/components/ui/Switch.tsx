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
 * Token-styled on/off switch (ARIA `role="switch"`). A `label` renders as visible text beside the
 * track (and doubles as the accessible name); pass `aria-label` instead for a switch whose label
 * lives elsewhere (e.g. a settings row). On = the flat cyan accent fill; off = a recessed card-2
 * track. The off-state outline is an inset hairline ring (a box-shadow, not a `border`) so the knob
 * sits at the exact same offset in both states — toggling slides it cleanly with no 1px jump.
 *
 * The track is `rounded-full` to match the round knob: a square outline hugging a circle read as a
 * mismatch. Switches are the one control the Wire system's square-corner rule exempts (DESIGN.md
 * §2.3) — everything else, chips and tags included, stays square.
 */
export function Switch({
  checked,
  onChange,
  disabled,
  label,
  'aria-label': ariaLabel,
  'data-testid': testId,
}: SwitchProps) {
  const track = (
    <span
      aria-hidden
      className={cn(
        'relative block shrink-0 w-10 h-6 rounded-full',
        'transition-[background-color,box-shadow] duration-[var(--motion-base)] ease-[var(--ease-standard)]',
        checked
          ? 'bg-accent'
          : 'bg-card-2 shadow-[inset_0_0_0_1px_var(--hairline)] group-hover:shadow-[inset_0_0_0_1px_var(--border-color)]',
      )}
    >
      <span
        className={cn(
          'absolute top-[3px] left-[3px] h-[18px] w-[18px] rounded-full bg-white',
          'transition-transform duration-[var(--motion-base)] ease-[var(--ease-standard)]',
          checked ? 'translate-x-[16px]' : 'translate-x-0',
        )}
      />
    </span>
  );

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
        'group inline-flex items-center gap-2.5 rounded-none cursor-pointer bg-transparent border-none p-0',
        FOCUS_RING,
        'disabled:opacity-50 disabled:cursor-not-allowed',
      )}
    >
      {track}
      {label && <span className="text-body text-secondary">{label}</span>}
    </button>
  );
}
