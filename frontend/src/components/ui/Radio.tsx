import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface RadioGroupContextValue {
  name: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

interface RadioGroupProps {
  name: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Radio group container. Wraps `Radio` children and owns the selected value.
 */
export function RadioGroup({ name, value, onChange, disabled, className, children }: RadioGroupProps) {
  return (
    <RadioGroupContext.Provider value={{ name, value, onChange, disabled }}>
      <div role="radiogroup" className={cn('flex flex-col gap-2', className)}>
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
}

interface RadioProps {
  value: string;
  label?: ReactNode;
  disabled?: boolean;
}

/**
 * A single radio option. Must be rendered inside a `RadioGroup`.
 */
export function Radio({ value, label, disabled: ownDisabled }: RadioProps) {
  const ctx = useContext(RadioGroupContext);
  if (!ctx) throw new Error('Radio must be used within a RadioGroup');
  const disabled = ownDisabled || ctx.disabled;
  const checked = ctx.value === value;
  return (
    <label
      className={cn(
        'inline-flex items-center gap-2 select-none',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
      )}
    >
      <span className="relative inline-flex h-4 w-4 shrink-0">
        <input
          type="radio"
          name={ctx.name}
          value={value}
          checked={checked}
          disabled={disabled}
          onChange={() => ctx.onChange(value)}
          className="peer absolute inset-0 z-10 m-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
        <span
          className={cn(
            'pointer-events-none absolute inset-0 rounded-full border border-border bg-card-2',
            'transition-colors duration-[var(--motion-fast)] ease-[var(--ease-standard)]',
            'peer-checked:border-accent',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-[color-mix(in_srgb,var(--accent-primary)_60%,transparent)]',
          )}
        />
        <span className="pointer-events-none absolute inset-0 m-auto h-2 w-2 rounded-full bg-accent opacity-0 transition-opacity duration-[var(--motion-fast)] peer-checked:opacity-100" />
      </span>
      {label != null && <span className="text-title text-secondary">{label}</span>}
    </label>
  );
}
