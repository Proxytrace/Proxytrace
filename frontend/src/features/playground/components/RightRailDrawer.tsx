/**
 * The slide-out drawer panel of the RightRail: displays the active section header
 * and its body (system prompt editor, parameter sliders, or tool editor).
 */
import { XIcon } from '../../../components/icons';
import { formInputCls } from '../../../components/ui/classes';
import type { ModelParametersDto } from '../../../api/models';
import type { PlaygroundOverrides } from '../state/types';
import { SECTION_TITLES, type SectionKey } from '../playgroundMeta';
import { ToolEditor } from './ToolEditor';
import { ParameterSlider } from './ParameterSlider';

const SECTION_HINTS: Record<SectionKey, string> = {
  system: 'Instructions sent to the model before user messages.',
  parameters: 'Sampling and budget controls.',
  tools: 'Tool specifications offered to the model.',
};

const REASONING_OPTIONS = [
  { value: null, label: 'Off' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
] as const;

interface Props {
  active: SectionKey;
  overrides: PlaygroundOverrides;
  defaultSystemPrompt?: string;
  defaultParameters?: ModelParametersDto | null;
  onChange: (next: PlaygroundOverrides) => void;
  onClose: () => void;
}

export function RightRailDrawer({
  active,
  overrides,
  defaultSystemPrompt,
  defaultParameters,
  onChange,
  onClose,
}: Props) {
  const systemPromptModified = defaultSystemPrompt != null && overrides.systemPrompt !== defaultSystemPrompt;

  const setParamRaw = (key: keyof ModelParametersDto, value: string) => {
    const v = value === '' ? null : Number(value);
    if (value !== '' && Number.isNaN(v)) return;
    onChange({ ...overrides, parameters: { ...overrides.parameters, [key]: v } });
  };

  const setParam = (key: keyof ModelParametersDto, value: number | null) => {
    onChange({ ...overrides, parameters: { ...overrides.parameters, [key]: value } });
  };

  return (
    <div className="w-[340px] rounded-lg flex flex-col overflow-hidden mr-[8px] fade-up bg-card border border-border shadow-[var(--shadow-card)]">
      <header className="flex items-center gap-[8px] px-[14px] py-[10px] border-b border-border">
        <div className="flex flex-col min-w-0">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">Settings</span>
          <span className="text-[13px] font-semibold text-primary truncate">{SECTION_TITLES[active]}</span>
        </div>
        <button
          type="button"
          className="ml-auto btn-icon"
          onClick={onClose}
          title="Close"
          aria-label="Close settings"
        >
          <XIcon size={13} strokeWidth={2.4} />
        </button>
      </header>

      <div className="px-[14px] py-[12px] overflow-y-auto flex-1 flex flex-col gap-[10px]">
        <p className="text-[11px] text-muted leading-[1.5]">{SECTION_HINTS[active]}</p>
        {active === 'system' && (
          <SystemSection
            overrides={overrides}
            defaultSystemPrompt={defaultSystemPrompt}
            systemPromptModified={systemPromptModified}
            onChange={onChange}
          />
        )}
        {active === 'parameters' && (
          <ParametersSection
            overrides={overrides}
            defaultParameters={defaultParameters}
            onChange={onChange}
            setParam={setParam}
            setParamRaw={setParamRaw}
          />
        )}
        {active === 'tools' && (
          <ToolEditor
            tools={overrides.tools}
            onChange={tools => onChange({ ...overrides, tools })}
          />
        )}
      </div>
    </div>
  );
}

// ─── Section subcomponents (private to this file) ──────────────────────────

interface SystemSectionProps {
  overrides: PlaygroundOverrides;
  defaultSystemPrompt?: string;
  systemPromptModified: boolean;
  onChange: (next: PlaygroundOverrides) => void;
}

function SystemSection({ overrides, defaultSystemPrompt, systemPromptModified, onChange }: SystemSectionProps) {
  return (
    <div className="flex flex-col gap-[6px]">
      <textarea
        className={`${formInputCls} resize-y mono text-[12px]`}
        rows={10}
        value={overrides.systemPrompt}
        onChange={e => onChange({ ...overrides, systemPrompt: e.target.value })}
        placeholder="System instructions sent to the agent"
        aria-label="System prompt"
      />
      <div className="flex justify-between text-[10.5px] text-muted mono">
        <span>{overrides.systemPrompt.length} chars</span>
        {systemPromptModified && defaultSystemPrompt != null && (
          <button
            type="button"
            onClick={() => onChange({ ...overrides, systemPrompt: defaultSystemPrompt })}
            className="text-accent hover:text-accent-hover transition-colors cursor-pointer"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}

interface ParametersSectionProps {
  overrides: PlaygroundOverrides;
  defaultParameters?: ModelParametersDto | null;
  onChange: (next: PlaygroundOverrides) => void;
  setParam: (key: keyof ModelParametersDto, value: number | null) => void;
  setParamRaw: (key: keyof ModelParametersDto, value: string) => void;
}

function ParametersSection({
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
        testId="parameter-slider-temperature"
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

interface ReasoningEffortControlProps {
  overrides: PlaygroundOverrides;
  onChange: (next: PlaygroundOverrides) => void;
}

function ReasoningEffortControl({ overrides, onChange }: ReasoningEffortControlProps) {
  return (
    <div className="flex flex-col gap-[5px]">
      <span className="text-[10.5px] text-muted uppercase tracking-[0.06em] font-semibold">Reasoning effort</span>
      <div
        role="radiogroup"
        aria-label="Reasoning effort"
        className="inline-flex p-[2px] rounded-[10px] gap-[2px] bg-[rgba(0,0,0,0.18)] border border-border"
      >
        {REASONING_OPTIONS.map(opt => {
          const sel = (overrides.parameters.reasoningEffort ?? null) === opt.value;
          return (
            <button
              key={opt.label}
              type="button"
              role="radio"
              aria-checked={sel}
              onClick={() => onChange({
                ...overrides,
                parameters: { ...overrides.parameters, reasoningEffort: opt.value },
              })}
              className={[
                'flex-1 px-[10px] py-[5px] rounded-[8px] text-[11.5px] font-medium cursor-pointer transition-colors',
                sel
                  ? 'bg-accent-subtle text-[var(--accent-hover)] border border-[color-mix(in_srgb,var(--accent-primary)_32%,transparent)]'
                  : 'bg-transparent text-secondary border border-transparent',
              ].join(' ')}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
