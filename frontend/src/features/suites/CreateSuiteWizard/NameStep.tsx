import { useRef, useState } from 'react';
import { cn } from '../../../lib/cn';
import { FormField } from '../../../components/ui/FormField';
import { formInputCls } from '../../../components/ui/classes';

interface Preset {
  key: string;
  name: string;
  description: string;
}

const PRESETS: Preset[] = [
  { key: 'golden',  name: 'Golden Path',   description: 'Canonical happy-path traces — the behavior you expect to never break.' },
  { key: 'regress', name: 'Regression',    description: 'Traces guarding against past bugs and previously-fixed issues.' },
  { key: 'edge',    name: 'Edge Cases',    description: 'Boundary inputs, unusual conversations, rare tool combinations.' },
  { key: 'failure', name: 'Failure Cases', description: 'Inputs the agent has historically struggled with — track improvements over time.' },
];

const findPreset = (value: string): string | null => {
  const match = PRESETS.find(p => p.name === value);
  if (match) {
    return match.key;
  }
  return null;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function NameStep({ value, onChange }: Props) {
  const [active, setActive] = useState<string | null>(findPreset(value));
  const inputRef = useRef<HTMLInputElement>(null);


  const description = active
    ? PRESETS.find(p => p.key === active)?.description
    : 'Pick a preset above or type your own name. You can edit it after.';

  return (
    <div data-testid="wizard-step-name" className="max-w-[640px] mx-auto flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-semibold text-muted uppercase tracking-[0.05em]">Quick presets</label>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(p => {
            const selected = active === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => { setActive(p.key); onChange(p.name); inputRef.current?.focus(); }}
                className={cn(
                  'cursor-pointer rounded-full text-[12px] font-semibold transition-colors duration-150 px-3 py-1.5 border',
                  selected
                    ? 'border-accent bg-accent-subtle text-accent-hover'
                    : 'border-border bg-card text-secondary',
                )}
              >
                {p.name}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => { setActive(null); onChange(''); inputRef.current?.focus(); }}
            className={cn(
              'cursor-pointer rounded-full text-[12px] font-semibold transition-colors duration-150 px-3 py-1.5 border border-dashed bg-transparent text-muted',
              active === null && !value ? 'border-accent' : 'border-border',
            )}
          >
            Custom…
          </button>
        </div>
        <p className="text-[12px] text-muted m-0 min-h-[18px]">{description}</p>
      </div>

      <FormField label="Suite name">
        <input
          ref={inputRef}
          data-testid="wizard-name-input"
          value={value}
          onChange={e => { setActive(null); onChange(e.target.value); }}
          placeholder="My regression suite"
          autoFocus
          className={formInputCls}
        />
      </FormField>
    </div>
  );
}
