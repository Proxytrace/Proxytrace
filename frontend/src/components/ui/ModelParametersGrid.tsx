import { Trans } from '@lingui/react/macro';
import type { ModelParametersDto } from '../../api/models';

/* eslint-disable lingui/no-unlocalized-strings -- OpenAI API field names, not UI copy */
const FIELD_LABELS: Record<keyof ModelParametersDto, string> = {
  temperature: 'temperature',
  topP: 'top_p',
  reasoningEffort: 'reasoning_effort',
  frequencyPenalty: 'frequency_penalty',
  presencePenalty: 'presence_penalty',
  maxTokens: 'max_tokens',
  seed: 'seed',
  stop: 'stop',
  n: 'n',
};
/* eslint-enable lingui/no-unlocalized-strings */

const FIELD_ORDER: (keyof ModelParametersDto)[] = [
  'temperature',
  'topP',
  'maxTokens',
  'reasoningEffort',
  'frequencyPenalty',
  'presencePenalty',
  'n',
  'seed',
  'stop',
];

function formatValue(key: keyof ModelParametersDto, value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (key === 'stop' && Array.isArray(value)) {
    if (value.length === 0) return '—';
    return value.map(s => `"${s}"`).join(', ');
  }
  return String(value);
}

function isSet(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function ModelParametersGrid({ params }: { params: ModelParametersDto }) {
  const setFields = FIELD_ORDER.filter(k => isSet(params[k]));

  if (setFields.length === 0) {
    return (
      <div className="px-3 py-[10px] bg-card-2 rounded-[8px] text-[12px] text-muted italic">
        <Trans>Default parameters (none specified)</Trans>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-[10px]">
      {setFields.map(k => (
        <div key={k} className="px-3 py-[10px] bg-card-2 rounded-[8px]">
          <div className="text-[10px] text-muted uppercase tracking-[0.06em] mb-[3px]">{FIELD_LABELS[k]}</div>
          <div className="text-[12px] font-mono text-primary break-all">{formatValue(k, params[k])}</div>
        </div>
      ))}
    </div>
  );
}
