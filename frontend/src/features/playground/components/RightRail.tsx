import { useState, type ReactNode } from 'react';
import {
  CpuIcon,
  SigmaIcon,
  SparklesIcon,
  XIcon,
} from '../../../components/icons';
import type { ModelParametersDto } from '../../../api/models';
import { formInputCls } from '../../../components/ui/FormField';
import type { PlaygroundOverrides } from '../state/types';
import { ToolEditor } from './ToolEditor';
import { ParameterSlider } from './ParameterSlider';

type SectionKey = 'system' | 'parameters' | 'tools';

interface Props {
  overrides: PlaygroundOverrides;
  defaultSystemPrompt?: string;
  defaultParameters?: ModelParametersDto | null;
  hasAgentDefaults: boolean;
  onChange: (next: PlaygroundOverrides) => void;
  onResetAll: () => void;
  initialSection?: SectionKey | null;
}

const REASONING_OPTIONS = [
  { value: null, label: 'Off' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
] as const;

const SECTION_TITLES: Record<SectionKey, string> = {
  system: 'System Prompt',
  parameters: 'Parameters',
  tools: 'Tools',
};

const SECTION_HINTS: Record<SectionKey, string> = {
  system: 'Instructions sent to the model before user messages.',
  parameters: 'Sampling and budget controls.',
  tools: 'Tool specifications offered to the model.',
};

function paramsModified(current: ModelParametersDto, defaults: ModelParametersDto | null | undefined): boolean {
  if (!defaults) return false;
  const keys: (keyof ModelParametersDto)[] = ['temperature','topP','frequencyPenalty','presencePenalty','maxTokens','seed','n','reasoningEffort'];
  return keys.some(k => (current[k] ?? null) !== (defaults[k] ?? null));
}

function toolsModified(current: PlaygroundOverrides['tools'], defaultLength: number): boolean {
  // Lightweight check; deep diff would require the agent default tools array.
  return current.length !== defaultLength;
}

interface IconButtonProps {
  active: boolean;
  modified: boolean;
  title: string;
  onClick: () => void;
  children: ReactNode;
}

function IconButton({ active, modified, title, onClick, children }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className="relative size-[40px] inline-flex items-center justify-center rounded-[10px] cursor-pointer transition-colors"
      style={{
        background: active ? 'var(--accent-subtle)' : 'transparent',
        color: active ? 'var(--accent-hover)' : 'var(--text-secondary)',
        border: `1px solid ${active ? 'rgba(201,148,74,0.32)' : 'transparent'}`,
      }}
    >
      {children}
      {modified && (
        <span
          aria-hidden
          className="absolute top-[6px] right-[6px] size-[7px] rounded-full bg-accent"
          style={{ boxShadow: '0 0 0 2px var(--bg-card-2)' }}
        />
      )}
    </button>
  );
}

export function RightRail({
  overrides,
  defaultSystemPrompt,
  defaultParameters,
  hasAgentDefaults,
  onChange,
  onResetAll,
  initialSection = null,
}: Props) {
  const [active, setActive] = useState<SectionKey | null>(initialSection);

  const setParamRaw = (key: keyof ModelParametersDto, value: string) => {
    const v = value === '' ? null : Number(value);
    if (value !== '' && Number.isNaN(v)) return;
    onChange({ ...overrides, parameters: { ...overrides.parameters, [key]: v } });
  };

  const setParam = (key: keyof ModelParametersDto, value: number | null) => {
    onChange({ ...overrides, parameters: { ...overrides.parameters, [key]: value } });
  };

  const systemPromptModified = defaultSystemPrompt != null && overrides.systemPrompt !== defaultSystemPrompt;
  const parametersModified = paramsModified(overrides.parameters, defaultParameters ?? null);
  const toolsModifiedFlag = toolsModified(overrides.tools, overrides.tools.length);
  const anyModified = systemPromptModified || parametersModified || toolsModifiedFlag;

  const toggle = (key: SectionKey) => setActive(prev => (prev === key ? null : key));

  const renderBody = () => {
    if (!active) return null;
    if (active === 'system') {
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
    if (active === 'parameters') {
      return (
        <div className="flex flex-col gap-[14px]">
          <ParameterSlider
            label="Temperature"
            value={overrides.parameters.temperature}
            defaultValue={defaultParameters?.temperature ?? null}
            min={0}
            max={2}
            step={0.01}
            onChange={v => setParam('temperature', v)}
          />
          <ParameterSlider
            label="Top-P"
            value={overrides.parameters.topP}
            defaultValue={defaultParameters?.topP ?? null}
            min={0}
            max={1}
            step={0.01}
            onChange={v => setParam('topP', v)}
          />
          <ParameterSlider
            label="Freq Penalty"
            value={overrides.parameters.frequencyPenalty}
            defaultValue={defaultParameters?.frequencyPenalty ?? null}
            min={-2}
            max={2}
            step={0.01}
            onChange={v => setParam('frequencyPenalty', v)}
          />
          <ParameterSlider
            label="Pres Penalty"
            value={overrides.parameters.presencePenalty}
            defaultValue={defaultParameters?.presencePenalty ?? null}
            min={-2}
            max={2}
            step={0.01}
            onChange={v => setParam('presencePenalty', v)}
          />

          <div className="grid grid-cols-3 gap-[6px]">
            <label className="flex flex-col gap-[3px]">
              <span className="text-[10.5px] text-muted">Max tokens</span>
              <input
                type="number"
                min={1}
                step={1}
                className={formInputCls}
                value={overrides.parameters.maxTokens ?? ''}
                placeholder="—"
                onChange={e => setParamRaw('maxTokens', e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-[3px]">
              <span className="text-[10.5px] text-muted">Seed</span>
              <input
                type="number"
                step={1}
                className={formInputCls}
                value={overrides.parameters.seed ?? ''}
                placeholder="—"
                onChange={e => setParamRaw('seed', e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-[3px]">
              <span className="text-[10.5px] text-muted">N</span>
              <input
                type="number"
                min={1}
                step={1}
                className={formInputCls}
                value={overrides.parameters.n ?? ''}
                placeholder="—"
                onChange={e => setParamRaw('n', e.target.value)}
              />
            </label>
          </div>

          <div className="flex flex-col gap-[5px]">
            <span className="text-[10.5px] text-muted uppercase tracking-[0.06em] font-semibold">Reasoning effort</span>
            <div
              role="radiogroup"
              aria-label="Reasoning effort"
              className="inline-flex p-[2px] rounded-[10px] gap-[2px]"
              style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid var(--border-color)' }}
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
                    className="flex-1 px-[10px] py-[5px] rounded-[8px] text-[11.5px] font-medium cursor-pointer transition-colors"
                    style={{
                      background: sel ? 'var(--accent-subtle)' : 'transparent',
                      color: sel ? 'var(--accent-hover)' : 'var(--text-secondary)',
                      border: `1px solid ${sel ? 'rgba(201,148,74,0.32)' : 'transparent'}`,
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      );
    }
    if (active === 'tools') {
      return (
        <ToolEditor
          tools={overrides.tools}
          onChange={tools => onChange({ ...overrides, tools })}
        />
      );
    }
    return null;
  };

  return (
    <div className="flex shrink-0">
      {/* Drawer (renders to the LEFT of the icon rail when open) */}
      {active && (
        <div
          className="w-[340px] rounded-[14px] flex flex-col overflow-hidden mr-[8px] fade-up"
          style={{
            background: 'var(--bg-card-2)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <header
            className="flex items-center gap-[8px] px-[14px] py-[10px]"
            style={{ borderBottom: '1px solid var(--border-color)' }}
          >
            <div className="flex flex-col min-w-0">
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">Settings</span>
              <span className="text-[13px] font-semibold text-primary truncate">{SECTION_TITLES[active]}</span>
            </div>
            <button
              type="button"
              className="ml-auto btn-icon"
              onClick={() => setActive(null)}
              title="Close"
              aria-label="Close settings"
            >
              <XIcon size={13} strokeWidth={2.4} />
            </button>
          </header>
          <div className="px-[14px] py-[12px] overflow-y-auto flex-1 flex flex-col gap-[10px]">
            <p className="text-[11px] text-muted leading-[1.5]">{SECTION_HINTS[active]}</p>
            {renderBody()}
          </div>
        </div>
      )}

      {/* Icon rail */}
      <div
        className="w-[56px] rounded-[14px] flex flex-col items-center py-[10px] gap-[6px]"
        style={{
          background: 'var(--bg-card-2)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <IconButton
          active={active === 'system'}
          modified={systemPromptModified}
          title="System prompt"
          onClick={() => toggle('system')}
        >
          <SparklesIcon size={16} strokeWidth={1.8} />
        </IconButton>
        <IconButton
          active={active === 'parameters'}
          modified={parametersModified}
          title="Parameters"
          onClick={() => toggle('parameters')}
        >
          <SigmaIcon size={16} strokeWidth={1.8} />
        </IconButton>
        <IconButton
          active={active === 'tools'}
          modified={toolsModifiedFlag}
          title="Tools"
          onClick={() => toggle('tools')}
        >
          <CpuIcon size={16} strokeWidth={1.8} />
        </IconButton>

        <div className="my-[4px] h-[1px] w-[24px]" style={{ background: 'var(--hairline)' }} />

        <button
          type="button"
          onClick={onResetAll}
          disabled={!hasAgentDefaults || !anyModified}
          title={anyModified ? 'Reset all settings to agent defaults' : 'Settings match agent defaults'}
          aria-label="Reset all to agent defaults"
          className="size-[40px] inline-flex items-center justify-center rounded-[10px] cursor-pointer transition-colors"
          style={{
            color: anyModified ? 'var(--accent-hover)' : 'var(--text-muted)',
            background: anyModified ? 'var(--accent-subtle)' : 'transparent',
            border: `1px solid ${anyModified ? 'rgba(201,148,74,0.32)' : 'transparent'}`,
            opacity: !hasAgentDefaults ? 0.4 : 1,
          }}
        >
          <ResetIcon />
        </button>
      </div>
    </div>
  );
}

function ResetIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <polyline points="3 4 3 9 8 9" />
    </svg>
  );
}
