/**
 * Reasoning-effort segmented control for the ParametersSection. An "off"
 * sentinel maps the null reasoning-effort value.
 */
import { Trans, useLingui } from '@lingui/react/macro';
import { msg } from '@lingui/core/macro';
import type { MessageDescriptor } from '@lingui/core';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import type { PlaygroundOverrides } from '../state/types';

const REASONING_OPTIONS: { value: 'low' | 'medium' | 'high' | null; label: MessageDescriptor }[] = [
  { value: null, label: msg`Off` },
  // eslint-disable-next-line lingui/no-unlocalized-strings -- reasoning-effort API enum token, not UI copy
  { value: 'low', label: msg`Low` },
  // eslint-disable-next-line lingui/no-unlocalized-strings -- reasoning-effort API enum token, not UI copy
  { value: 'medium', label: msg`Medium` },
  // eslint-disable-next-line lingui/no-unlocalized-strings -- reasoning-effort API enum token, not UI copy
  { value: 'high', label: msg`High` },
];

interface ReasoningEffortControlProps {
  overrides: PlaygroundOverrides;
  onChange: (next: PlaygroundOverrides) => void;
}

export function ReasoningEffortControl({ overrides, onChange }: ReasoningEffortControlProps) {
  const { i18n } = useLingui();
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-caption text-secondary uppercase tracking-[0.06em] font-semibold"><Trans>Reasoning effort</Trans></span>
      <SegmentedControl
        // eslint-disable-next-line lingui/no-unlocalized-strings -- "off" sentinel maps null reasoning effort, not UI copy
        value={overrides.parameters.reasoningEffort ?? 'off'}
        onChange={v => onChange({
          ...overrides,
          parameters: { ...overrides.parameters, reasoningEffort: v === 'off' ? null : v },
        })}
        // eslint-disable-next-line lingui/no-unlocalized-strings -- "off" sentinel maps null reasoning effort, not UI copy
        segments={REASONING_OPTIONS.map(opt => ({ value: opt.value ?? 'off', label: i18n._(opt.label) }))}
      />
    </div>
  );
}
