import { formInputCls } from '../../../components/ui/classes';
import type { ModelParametersDto } from '../../../api/models';
import type { PlaygroundOverrides } from '../state/types';
import { ParameterSlider } from './ParameterSlider';
import { ReasoningEffortControl } from './ReasoningEffortControl';

interface ParametersSectionProps {
  overrides: PlaygroundOverrides;
  defaultParameters?: ModelParametersDto | null;
  onChange: (next: PlaygroundOverrides) => void;
  setParam: (key: keyof ModelParametersDto, value: number | null) => void;
  setParamRaw: (key: keyof ModelParametersDto, value: string) => void;
}

export function ParametersSection({
  overrides,
  defaultParameters,
  onChange,
  setParam,
  setParamRaw,
}: ParametersSectionProps) {
  return (
    <div className="flex flex-col gap-[14px]">
      <ParameterSlider
        label="Temperature"
        value={overrides.parameters.temperature}
        defaultValue={defaultParameters?.temperature ?? null}
        min={0} max={2} step={0.01}
        onChange={v => setParam('temperature', v)}
      />
      <ParameterSlider
        label="Top-P"
        value={overrides.parameters.topP}
        defaultValue={defaultParameters?.topP ?? null}
        min={0} max={1} step={0.01}
        onChange={v => setParam('topP', v)}
      />
      <ParameterSlider
        label="Freq Penalty"
        value={overrides.parameters.frequencyPenalty}
        defaultValue={defaultParameters?.frequencyPenalty ?? null}
        min={-2} max={2} step={0.01}
        onChange={v => setParam('frequencyPenalty', v)}
      />
      <ParameterSlider
        label="Pres Penalty"
        value={overrides.parameters.presencePenalty}
        defaultValue={defaultParameters?.presencePenalty ?? null}
        min={-2} max={2} step={0.01}
        onChange={v => setParam('presencePenalty', v)}
      />

      <div className="grid grid-cols-3 gap-[6px]">
        <label className="flex flex-col gap-[3px]">
          <span className="text-[10.5px] text-muted">Max tokens</span>
          <input
            type="number" min={1} step={1}
            className={formInputCls}
            value={overrides.parameters.maxTokens ?? ''}
            placeholder="—"
            onChange={e => setParamRaw('maxTokens', e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-[3px]">
          <span className="text-[10.5px] text-muted">Seed</span>
          <input
            type="number" step={1}
            className={formInputCls}
            value={overrides.parameters.seed ?? ''}
            placeholder="—"
            onChange={e => setParamRaw('seed', e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-[3px]">
          <span className="text-[10.5px] text-muted">N</span>
          <input
            type="number" min={1} step={1}
            className={formInputCls}
            value={overrides.parameters.n ?? ''}
            placeholder="—"
            onChange={e => setParamRaw('n', e.target.value)}
          />
        </label>
      </div>

      <ReasoningEffortControl overrides={overrides} onChange={onChange} />
    </div>
  );
}
