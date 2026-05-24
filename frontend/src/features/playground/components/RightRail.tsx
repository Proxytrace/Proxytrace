/**
 * RightRail — vertical icon strip + slide-out settings drawer.
 *
 * The icon strip shows three section buttons (system prompt, parameters, tools)
 * and a reset button. Clicking a button toggles the drawer for that section.
 */
import { useState, type ReactNode } from 'react';
import { CpuIcon, ResetIcon, SigmaIcon, SparklesIcon } from '../../../components/icons';
import { cn } from '../../../lib/cn';
import type { ModelParametersDto } from '../../../api/models';
import type { PlaygroundOverrides } from '../state/types';
import type { SectionKey } from '../playgroundMeta';
import { RightRailDrawer } from './RightRailDrawer';

interface Props {
  overrides: PlaygroundOverrides;
  defaultSystemPrompt?: string;
  defaultParameters?: ModelParametersDto | null;
  hasAgentDefaults: boolean;
  onChange: (next: PlaygroundOverrides) => void;
  onResetAll: () => void;
  initialSection?: SectionKey | null;
}

// ─── Modified-state helpers ─────────────────────────────────────────────────

function paramsModified(current: ModelParametersDto, defaults: ModelParametersDto | null): boolean {
  if (!defaults) return false;
  const keys: (keyof ModelParametersDto)[] = [
    'temperature', 'topP', 'frequencyPenalty', 'presencePenalty',
    'maxTokens', 'seed', 'n', 'reasoningEffort',
  ];
  return keys.some(k => (current[k] ?? null) !== (defaults[k] ?? null));
}

function toolsModified(current: PlaygroundOverrides['tools'], defaultLength: number): boolean {
  return current.length !== defaultLength;
}

// ─── RailIconButton ─────────────────────────────────────────────────────────

interface RailIconButtonProps {
  active: boolean;
  modified: boolean;
  title: string;
  onClick: () => void;
  children: ReactNode;
}

function RailIconButton({ active, modified, title, onClick, children }: RailIconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={cn(
        'relative size-[40px] inline-flex items-center justify-center rounded-[10px] cursor-pointer transition-colors border',
        active
          ? 'bg-accent-subtle text-[var(--accent-hover)] border-[color-mix(in_srgb,var(--accent-primary)_32%,transparent)]'
          : 'bg-transparent text-secondary border-transparent',
      )}
    >
      {children}
      {modified && (
        <span
          aria-hidden
          className="absolute top-[6px] right-[6px] size-[7px] rounded-full bg-accent shadow-[0_0_0_2px_var(--bg-card)]"
        />
      )}
    </button>
  );
}

// ─── RightRail ──────────────────────────────────────────────────────────────

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

  const systemPromptModified = defaultSystemPrompt != null && overrides.systemPrompt !== defaultSystemPrompt;
  const parametersModified = paramsModified(overrides.parameters, defaultParameters ?? null);
  const toolsModifiedFlag = toolsModified(overrides.tools, overrides.tools.length);
  const anyModified = systemPromptModified || parametersModified || toolsModifiedFlag;

  const toggle = (key: SectionKey) => setActive(prev => (prev === key ? null : key));

  return (
    <div className="flex shrink-0">
      {active && (
        <RightRailDrawer
          active={active}
          overrides={overrides}
          defaultSystemPrompt={defaultSystemPrompt}
          defaultParameters={defaultParameters}
          onChange={onChange}
          onClose={() => setActive(null)}
        />
      )}

      {/* Icon rail */}
      <div className="w-[56px] rounded-lg flex flex-col items-center py-[10px] gap-[6px] bg-card border border-border shadow-[var(--shadow-card)]">
        <RailIconButton
          active={active === 'system'}
          modified={systemPromptModified}
          title="System prompt"
          onClick={() => toggle('system')}
        >
          <SparklesIcon size={16} strokeWidth={1.8} />
        </RailIconButton>
        <RailIconButton
          active={active === 'parameters'}
          modified={parametersModified}
          title="Parameters"
          onClick={() => toggle('parameters')}
        >
          <SigmaIcon size={16} strokeWidth={1.8} />
        </RailIconButton>
        <RailIconButton
          active={active === 'tools'}
          modified={toolsModifiedFlag}
          title="Tools"
          onClick={() => toggle('tools')}
        >
          <CpuIcon size={16} strokeWidth={1.8} />
        </RailIconButton>

        <div className="my-[4px] h-[1px] w-[24px] bg-[var(--hairline)]" />

        <button
          type="button"
          onClick={onResetAll}
          disabled={!hasAgentDefaults || !anyModified}
          title={anyModified ? 'Reset all settings to agent defaults' : 'Settings match agent defaults'}
          aria-label="Reset all to agent defaults"
          className={cn(
            'size-[40px] inline-flex items-center justify-center rounded-[10px] cursor-pointer transition-colors border',
            anyModified
              ? 'bg-accent-subtle text-[var(--accent-hover)] border-[color-mix(in_srgb,var(--accent-primary)_32%,transparent)]'
              : 'bg-transparent text-muted border-transparent',
            !hasAgentDefaults && 'opacity-40',
          )}
        >
          <ResetIcon size={15} />
        </button>
      </div>
    </div>
  );
}
