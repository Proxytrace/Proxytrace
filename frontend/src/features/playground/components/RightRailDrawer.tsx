/**
 * The slide-out drawer panel of the RightRail: displays the active section header
 * and its body (system prompt editor, parameter sliders, or tool editor).
 */
import { Trans, useLingui } from '@lingui/react/macro';
import { msg } from '@lingui/core/macro';
import type { MessageDescriptor } from '@lingui/core';
import { XIcon } from '../../../components/icons';
import { IconButton } from '../../../components/ui/Button';
import type { ModelParametersDto } from '../../../api/models';
import type { PlaygroundOverrides } from '../state/types';
import { SECTION_TITLES, type SectionKey } from '../playgroundMeta';
import { ToolEditor } from './ToolEditor';
import { SystemSection } from './SystemSection';
import { ParametersSection } from './ParametersSection';

const SECTION_HINTS: Record<SectionKey, MessageDescriptor> = {
  system: msg`Instructions sent to the model before user messages.`,
  parameters: msg`Sampling and budget controls.`,
  tools: msg`Tool specifications offered to the model.`,
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
  const { t, i18n } = useLingui();
  const systemPromptModified = defaultSystemPrompt != null && overrides.systemPrompt !== defaultSystemPrompt;

  return (
    <div className="w-[340px] rounded-lg flex flex-col overflow-hidden mr-2 fade-up bg-card border border-border shadow-[var(--shadow-card)]">
      <header className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
        <div className="flex flex-col min-w-0">
          <span className="text-caption font-semibold uppercase tracking-[0.08em] text-muted"><Trans>Settings</Trans></span>
          <span className="text-title font-semibold text-primary truncate">{i18n._(SECTION_TITLES[active])}</span>
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

      <div className="px-3.5 py-3 overflow-y-auto flex-1 flex flex-col gap-2.5">
        <p className="text-body-sm text-muted leading-[1.5]">{i18n._(SECTION_HINTS[active])}</p>
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
