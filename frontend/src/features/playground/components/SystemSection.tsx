/**
 * System-prompt editor section of the RightRailDrawer: a textarea plus a char
 * count and a reset-to-default affordance.
 */
import { Trans, useLingui } from '@lingui/react/macro';
import { Button } from '../../../components/ui/Button';
import { Textarea } from '../../../components/ui/Textarea';
import type { PlaygroundOverrides } from '../state/types';

interface SystemSectionProps {
  overrides: PlaygroundOverrides;
  defaultSystemPrompt?: string;
  systemPromptModified: boolean;
  onChange: (next: PlaygroundOverrides) => void;
}

export function SystemSection({ overrides, defaultSystemPrompt, systemPromptModified, onChange }: SystemSectionProps) {
  const { t } = useLingui();
  return (
    <div className="flex flex-col gap-1.5">
      <Textarea
        className="mono text-body"
        rows={10}
        value={overrides.systemPrompt}
        onChange={e => onChange({ ...overrides, systemPrompt: e.target.value })}
        placeholder={t`System instructions sent to the agent`}
        aria-label={t`System prompt`}
      />
      <div className="flex justify-between text-caption text-muted mono">
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
