import { useId } from 'react';
import { cn } from '../../../lib/cn';

interface Props {
  label: string;
  value: number | null;
  defaultValue: number | null;
  min: number;
  max: number;
  step: number;
  onChange: (next: number | null) => void;
  hint?: string;
}

export function ParameterSlider({ label, value, defaultValue, min, max, step, onChange, hint }: Props) {
  const id = useId();
  const isModified = value !== defaultValue && !(value == null && defaultValue == null);
  const effective = value ?? defaultValue ?? min;
  const display = value == null ? '—' : effective.toFixed(step < 1 ? 2 : 0);
  const fillPct = Math.max(0, Math.min(100, ((effective - min) / (max - min)) * 100));

  return (
    <div className="flex flex-col gap-[6px]">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="flex items-center gap-[6px] text-[10.5px] text-secondary uppercase tracking-[0.06em] font-semibold">
          {label}
          {isModified && (
            <span
              aria-label="modified"
              title="Modified from agent default"
              className="size-[5px] rounded-full bg-accent shadow-[0_0_0_2px_var(--accent-subtle)]"
            />
          )}
        </label>
        <div className="flex items-center gap-[6px]">
          <span
            className={cn(
              'mono text-[11px] tabular-nums px-[6px] py-[1px] rounded-[6px] border border-border',
              'bg-[rgba(0,0,0,0.18)] min-w-[42px] text-right',
              value == null ? 'text-muted' : 'text-primary',
            )}
          >
            {display}
          </span>
        </div>
      </div>
      <div className="relative h-[20px] flex items-center">
        <div
          className="absolute left-0 right-0 h-[4px] rounded-full bg-[rgba(255,255,255,0.06)]"
        />
        <div
          className={cn(
            'absolute left-0 h-[4px] rounded-full pointer-events-none',
            value == null
              ? 'bg-[rgba(255,255,255,0.10)]'
              : 'bg-[linear-gradient(90deg,var(--accent-primary),var(--accent-hover))]',
          )}
          style={{ width: `${fillPct}%` }}
        />
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={effective}
          onChange={e => onChange(Number(e.target.value))}
          aria-label={label}
          className="param-slider relative w-full appearance-none bg-transparent cursor-pointer"
        />
      </div>
      {hint && <span className="text-[10.5px] text-muted">{hint}</span>}
    </div>
  );
}
