import type { ModelParametersDto } from '../../../api/models';
import { formInputCls } from '../../../components/ui/FormField';
import type { PlaygroundOverrides } from '../state/types';
import { EndpointPicker } from './EndpointPicker';
import { ToolEditor } from './ToolEditor';

interface Props {
  overrides: PlaygroundOverrides;
  defaultEndpointId: string | undefined;
  onChange: (next: PlaygroundOverrides) => void;
}

const NUMERIC_FIELDS: { key: keyof ModelParametersDto; label: string; step: number }[] = [
  { key: 'temperature', label: 'Temperature', step: 0.1 },
  { key: 'topP', label: 'Top-P', step: 0.05 },
  { key: 'frequencyPenalty', label: 'Freq Penalty', step: 0.1 },
  { key: 'presencePenalty', label: 'Pres Penalty', step: 0.1 },
  { key: 'maxTokens', label: 'Max Tokens', step: 1 },
  { key: 'seed', label: 'Seed', step: 1 },
  { key: 'n', label: 'N', step: 1 },
];

export function OverridesPanel({ overrides, defaultEndpointId, onChange }: Props) {
  const setParam = (key: keyof ModelParametersDto, value: string) => {
    const v = value === '' ? null : Number(value);
    if (value !== '' && Number.isNaN(v)) return;
    onChange({ ...overrides, parameters: { ...overrides.parameters, [key]: v } });
  };

  return (
    <div className="flex flex-col gap-[14px] p-[14px] overflow-y-auto h-full">
      <EndpointPicker
        value={overrides.endpointId}
        defaultEndpointId={defaultEndpointId}
        onChange={endpointId => onChange({ ...overrides, endpointId })}
      />

      <div className="flex flex-col gap-[5px]">
        <label className="text-[11px] font-semibold text-muted uppercase tracking-[0.05em]">System prompt</label>
        <textarea
          className={`${formInputCls} resize-y font-mono text-[12px]`}
          rows={6}
          value={overrides.systemPrompt}
          onChange={e => onChange({ ...overrides, systemPrompt: e.target.value })}
          placeholder="System instructions sent to the agent"
        />
      </div>

      <div className="flex flex-col gap-[8px]">
        <div className="text-[11px] font-semibold text-muted uppercase tracking-[0.05em]">Model parameters</div>
        <div className="grid grid-cols-2 gap-[6px]">
          {NUMERIC_FIELDS.map(f => (
            <label key={f.key} className="flex flex-col gap-[3px]">
              <span className="text-[10.5px] text-muted">{f.label}</span>
              <input
                type="number"
                step={f.step}
                className={formInputCls}
                value={(overrides.parameters[f.key] as number | null) ?? ''}
                placeholder="—"
                onChange={e => setParam(f.key, e.target.value)}
              />
            </label>
          ))}
          <label className="flex flex-col gap-[3px] col-span-2">
            <span className="text-[10.5px] text-muted">Reasoning effort</span>
            <input
              className={formInputCls}
              value={overrides.parameters.reasoningEffort ?? ''}
              placeholder="—"
              onChange={e =>
                onChange({
                  ...overrides,
                  parameters: { ...overrides.parameters, reasoningEffort: e.target.value || null },
                })
              }
            />
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-[6px]">
        <div className="text-[11px] font-semibold text-muted uppercase tracking-[0.05em]">Tools</div>
        <ToolEditor
          tools={overrides.tools}
          onChange={tools => onChange({ ...overrides, tools })}
        />
      </div>
    </div>
  );
}
