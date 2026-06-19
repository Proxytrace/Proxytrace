import { useRef, useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { msg } from '@lingui/core/macro';
import type { MessageDescriptor } from '@lingui/core';
import { cn } from '../../../lib/cn';
import { FormField } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';

interface Preset {
  key: string;
  name: MessageDescriptor;
  description: MessageDescriptor;
}

const PRESETS: Preset[] = [
  { key: 'golden',  name: msg`Golden Path`,   description: msg`Canonical happy-path traces — the behavior you expect to never break.` },
  { key: 'regress', name: msg`Regression`,    description: msg`Traces guarding against past bugs and previously-fixed issues.` },
  { key: 'edge',    name: msg`Edge Cases`,    description: msg`Boundary inputs, unusual conversations, rare tool combinations.` },
  { key: 'failure', name: msg`Failure Cases`, description: msg`Inputs the agent has historically struggled with — track improvements over time.` },
];

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function NameStep({ value, onChange }: Props) {
  const { i18n, t } = useLingui();
  const findPreset = (v: string): string | null =>
    PRESETS.find(p => i18n._(p.name) === v)?.key ?? null;

  const [active, setActive] = useState<string | null>(findPreset(value));
  const inputRef = useRef<HTMLInputElement>(null);


  const activePreset = active ? PRESETS.find(p => p.key === active) : undefined;
  const description = activePreset
    ? i18n._(activePreset.description)
    : t`Pick a preset above or type your own name. You can edit it after.`;

  return (
    <div data-testid="wizard-step-name" className="max-w-[640px] mx-auto flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-semibold text-muted uppercase tracking-[0.05em]"><Trans>Quick presets</Trans></label>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(p => {
            const selected = active === p.key;
            return (
              // eslint-disable-next-line no-restricted-syntax -- single-select preset toggle pill
              <button
                key={p.key}
                type="button"
                onClick={() => { setActive(p.key); onChange(i18n._(p.name)); inputRef.current?.focus(); }}
                className={cn(
                  'cursor-pointer rounded-full text-[12px] font-semibold transition-colors duration-150 px-3 py-1.5 border',
                  selected
                    ? 'border-accent bg-accent-subtle text-accent-hover'
                    : 'border-border bg-card text-secondary',
                )}
              >
                {i18n._(p.name)}
              </button>
            );
          })}
          {/* eslint-disable-next-line no-restricted-syntax -- "custom name" toggle pill */}
          <button
            type="button"
            onClick={() => { setActive(null); onChange(''); inputRef.current?.focus(); }}
            className={cn(
              'cursor-pointer rounded-full text-[12px] font-semibold transition-colors duration-150 px-3 py-1.5 border border-dashed bg-transparent text-muted',
              active === null && !value ? 'border-accent' : 'border-border',
            )}
          >
            <Trans>Custom…</Trans>
          </button>
        </div>
        <p className="text-[12px] text-muted m-0 min-h-[18px]">{description}</p>
      </div>

      <FormField label={t`Suite name`}>
        <Input
          ref={inputRef}
          data-testid="wizard-name-input"
          value={value}
          onChange={e => { setActive(null); onChange(e.target.value); }}
          placeholder={t`My regression suite`}
          autoFocus
        />
      </FormField>
    </div>
  );
}
