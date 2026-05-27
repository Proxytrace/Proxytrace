/**
 * The slide-out drawer panel of the RightRail: displays the active section header
 * and its body (system prompt editor, parameter sliders, or tool editor).
 */
import { XIcon } from '../../../components/icons';
import type { ModelParametersDto } from '../../../api/models';
import type { PlaygroundOverrides } from '../state/types';
import { SECTION_TITLES, type SectionKey } from '../playgroundMeta';
import { ToolEditor } from './ToolEditor';
import { SystemSection } from './SystemSection';
import { ParametersSection } from './ParametersSection';

const SECTION_HINTS: Record<SectionKey, string> = {
  system: 'Instructions sent to the model before user messages.',
  parameters: 'Sampling and budget controls.',
  tools: 'Tool specifications offered to the model.',
};

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
