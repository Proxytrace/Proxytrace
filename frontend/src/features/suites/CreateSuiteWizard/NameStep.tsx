import { useRef, useState } from 'react';
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
    <div className="max-w-[640px] mx-auto flex flex-col gap-4">
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
                className="cursor-pointer rounded-full text-[12px] font-semibold transition-colors duration-150"
                style={{
                  padding: '6px 12px',
                  border: `1px solid ${selected ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                  background: selected ? 'var(--accent-subtle)' : 'var(--bg-card)',
                  color: selected ? 'var(--accent-hover)' : 'var(--text-secondary)',
                }}
              >
                {p.name}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => { setActive(null); onChange(''); inputRef.current?.focus(); }}
            className="cursor-pointer rounded-full text-[12px] font-semibold transition-colors duration-150"
            style={{
              padding: '6px 12px',
              border: `1px dashed ${active === null && !value ? 'var(--accent-primary)' : 'var(--border-color)'}`,
              background: 'transparent',
              color: 'var(--text-muted)',
            }}
          >
            Custom…
          </button>
        </div>
        <p className="text-[12px] text-muted m-0 min-h-[18px]">{description}</p>
      </div>

      <FormField label="Suite name">
        <input
          ref={inputRef}
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
