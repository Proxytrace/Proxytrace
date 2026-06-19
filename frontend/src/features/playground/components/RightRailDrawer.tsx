/**
 * The slide-out drawer panel of the RightRail: displays the active section header
 * and its body (system prompt editor, parameter sliders, or tool editor).
 */
import { Trans, useLingui } from '@lingui/react/macro';
import { msg } from '@lingui/core/macro';
import type { MessageDescriptor } from '@lingui/core';
import { XIcon } from '../../../components/icons';
import { Button, IconButton } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Textarea } from '../../../components/ui/Textarea';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import type { ModelParametersDto } from '../../../api/models';
import type { PlaygroundOverrides } from '../state/types';
import { SECTION_TITLES, type SectionKey } from '../playgroundMeta';
import { ToolEditor } from './ToolEditor';
import { ParameterSlider } from './ParameterSlider';

const SECTION_HINTS: Record<SectionKey, MessageDescriptor> = {
  system: msg`Instructions sent to the model before user messages.`,
  parameters: msg`Sampling and budget controls.`,
  tools: msg`Tool specifications offered to the model.`,
};

const REASONING_OPTIONS: { value: 'low' | 'medium' | 'high' | null; label: MessageDescriptor }[] = [
  { value: null, label: msg`Off` },
  { value: 'low', label: msg`Low` },
  { value: 'medium', label: msg`Medium` },
  { value: 'high', label: msg`High` },
];

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
  const { t, i18n } = useLingui();
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
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted"><Trans>Settings</Trans></span>
          <span className="text-[13px] font-semibold text-primary truncate">{i18n._(SECTION_TITLES[active])}</span>
        </div>
        <IconButton
          className="ml-auto"
          onClick={onClose}
          title={t`Close`}
          aria-label={t`Close settings`}
        >
          <XIcon size={13} strokeWidth={2.4} />
        </IconButton>
      </header>

      <div className="px-[14px] py-[12px] overflow-y-auto flex-1 flex flex-col gap-[10px]">
        <p className="text-[11px] text-muted leading-[1.5]">{i18n._(SECTION_HINTS[active])}</p>
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
  const { t } = useLingui();
  return (
    <div className="flex flex-col gap-[6px]">
      <Textarea
        className="mono text-[12px]"
        rows={10}
        value={overrides.systemPrompt}
        onChange={e => onChange({ ...overrides, systemPrompt: e.target.value })}
        placeholder={t`System instructions sent to the agent`}
        aria-label={t`System prompt`}
      />
      <div className="flex justify-between text-[10.5px] text-muted mono">
        <span><Trans>{overrides.systemPrompt.length} chars</Trans></span>
        {systemPromptModified && defaultSystemPrompt != null && (
          <Button variant="link" onClick={() => onChange({ ...overrides, systemPrompt: defaultSystemPrompt })}>
            <Trans>Reset</Trans>
          </Button>
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
  const { t } = useLingui();
  return (
    <div className="flex flex-col gap-[14px]">
      <ParameterSlider
        label={t`Temperature`}
        value={overrides.parameters.temperature}
        defaultValue={defaultParameters?.temperature ?? null}
        min={0} max={2} step={0.01}
        onChange={v => setParam('temperature', v)}
        testId="parameter-slider-temperature"
      />
      <ParameterSlider
        label={t`Top-P`}
        value={overrides.parameters.topP}
        defaultValue={defaultParameters?.topP ?? null}
        min={0} max={1} step={0.01}
        onChange={v => setParam('topP', v)}
      />
      <ParameterSlider
        label={t`Freq Penalty`}
        value={overrides.parameters.frequencyPenalty}
        defaultValue={defaultParameters?.frequencyPenalty ?? null}
        min={-2} max={2} step={0.01}
        onChange={v => setParam('frequencyPenalty', v)}
      />
      <ParameterSlider
        label={t`Pres Penalty`}
        value={overrides.parameters.presencePenalty}
        defaultValue={defaultParameters?.presencePenalty ?? null}
        min={-2} max={2} step={0.01}
        onChange={v => setParam('presencePenalty', v)}
      />

      <div className="grid grid-cols-3 gap-[6px]">
        <label className="flex flex-col gap-[3px]">
          <span className="text-[10.5px] text-muted"><Trans>Max tokens</Trans></span>
          <Input
            type="number" min={1} step={1}
            value={overrides.parameters.maxTokens ?? ''}
            placeholder="—"
            onChange={e => setParamRaw('maxTokens', e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-[3px]">
          <span className="text-[10.5px] text-muted"><Trans>Seed</Trans></span>
          <Input
            type="number" step={1}
            value={overrides.parameters.seed ?? ''}
            placeholder="—"
            onChange={e => setParamRaw('seed', e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-[3px]">
          <span className="text-[10.5px] text-muted"><Trans>N</Trans></span>
          <Input
            type="number" min={1} step={1}
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
  const { i18n } = useLingui();
  return (
    <div className="flex flex-col gap-[5px]">
      <span className="text-[10.5px] text-muted uppercase tracking-[0.06em] font-semibold"><Trans>Reasoning effort</Trans></span>
      <SegmentedControl
        value={overrides.parameters.reasoningEffort ?? 'off'}
        onChange={v => onChange({
          ...overrides,
          parameters: { ...overrides.parameters, reasoningEffort: v === 'off' ? null : v },
        })}
        segments={REASONING_OPTIONS.map(opt => ({ value: opt.value ?? 'off', label: i18n._(opt.label) }))}
      />
    </div>
  );
}
