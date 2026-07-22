import type { KeyboardEvent } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { FormField } from '../../../components/ui/FormField';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { RowButton } from '../../../components/ui/RowButton';
import { cn } from '../../../lib/cn';
import { PROVIDER_PRESETS, presetById, type ProviderPresetId } from '../setupMeta';

interface ProviderStepProps {
  presetId: ProviderPresetId;
  providerName: string;
  providerEndpoint: string;
  providerApiKey: string;
  providerFilled: boolean;
  testing: boolean;
  testResult: { tone: 'success' | 'warning' | 'error'; message: string } | null;
  error: string | null;
  onPresetChange: (id: ProviderPresetId) => void;
  onNameChange: (v: string) => void;
  onEndpointChange: (v: string) => void;
  onApiKeyChange: (v: string) => void;
  onTestConnection: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
}

export function ProviderStep({
  presetId,
  providerName,
  providerEndpoint,
  providerApiKey,
  providerFilled,
  testing,
  testResult,
  error,
  onPresetChange,
  onNameChange,
  onEndpointChange,
  onApiKeyChange,
  onTestConnection,
  onKeyDown,
}: ProviderStepProps) {
  const { t, i18n } = useLingui();
  const preset = presetById(presetId);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" data-testid="setup-preset-list">
        {PROVIDER_PRESETS.map(p => {
          const selected = p.id === presetId;
          return (
            <RowButton
              key={p.id}
              onClick={() => onPresetChange(p.id)}
              aria-pressed={selected}
              data-testid={`setup-preset-${p.id}`}
              className={cn(
                'rounded-md border px-3 py-2.5 text-title font-medium text-center transition-colors duration-[var(--motion-fast)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent-primary)_60%,transparent)]',
                selected
                  ? 'border-[color:var(--accent-border)] bg-accent-subtle text-accent-text'
                  : 'border-border bg-card-2 text-secondary hover:text-primary hover:bg-card',
              )}
            >
              {i18n._(p.label)}
            </RowButton>
          );
        })}
      </div>

      <p className="text-body-sm text-muted leading-relaxed -mt-1">{i18n._(preset.hint)}</p>

      <FormField label={t`Provider name`}>
        <Input
          placeholder={t`e.g. OpenAI Production`}
          value={providerName}
          onChange={e => onNameChange(e.target.value)}
          onKeyDown={onKeyDown}
          data-testid="setup-provider-name"
        />
      </FormField>
      <FormField label={t`Endpoint URL`}>
        <Input
          placeholder={preset.endpointPlaceholder}
          value={providerEndpoint}
          onChange={e => onEndpointChange(e.target.value)}
          onKeyDown={onKeyDown}
          className="font-mono"
          data-testid="setup-provider-endpoint"
        />
      </FormField>
      <FormField label={t`Upstream API key`} error={error ?? undefined}>
        <Input
          type="password"
          placeholder={preset.keyPlaceholder}
          value={providerApiKey}
          onChange={e => onApiKeyChange(e.target.value)}
          onKeyDown={onKeyDown}
          autoComplete="off"
          data-testid="setup-provider-key"
        />
      </FormField>

      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={onTestConnection}
          disabled={!providerFilled || testing}
          loading={testing}
          data-testid="setup-test-connection-btn"
        >
          <Trans>Test connection</Trans>
        </Button>
        {testResult && (
          <span className={cn(
            'text-body',
            testResult.tone === 'success' && 'text-success',
            testResult.tone === 'warning' && 'text-warn',
            testResult.tone === 'error' && 'text-danger',
          )} role={testResult.tone === 'error' ? 'alert' : 'status'} aria-live={testResult.tone === 'error' ? 'assertive' : 'polite'}>
            {testResult.message}
          </span>
        )}
      </div>
      <p className="text-body-sm text-muted leading-relaxed">
        <Trans>Stored encrypted. Used only to forward proxied requests upstream.</Trans>
      </p>
    </div>
  );
}
