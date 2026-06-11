import type { KeyboardEvent } from 'react';
import { FormField } from '../../../components/ui/FormField';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { ModelProviderKind } from '../../../api/models';
import { PROVIDER_KIND_OPTIONS } from '../setupMeta';

interface ProviderStepProps {
  providerKind: ModelProviderKind;
  providerName: string;
  providerEndpoint: string;
  providerApiKey: string;
  providerFilled: boolean;
  testing: boolean;
  testResult: { ok: boolean; message: string } | null;
  error: string | null;
  onKindChange: (kind: ModelProviderKind) => void;
  onNameChange: (v: string) => void;
  onEndpointChange: (v: string) => void;
  onApiKeyChange: (v: string) => void;
  onTestConnection: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
}

export function ProviderStep({
  providerKind,
  providerName,
  providerEndpoint,
  providerApiKey,
  providerFilled,
  testing,
  testResult,
  error,
  onKindChange,
  onNameChange,
  onEndpointChange,
  onApiKeyChange,
  onTestConnection,
  onKeyDown,
}: ProviderStepProps) {
  return (
    <div className="flex flex-col gap-4">
      <FormField label="Provider type">
        <Select value={providerKind} onValueChange={v => onKindChange(v as ModelProviderKind)}>
          {PROVIDER_KIND_OPTIONS.map(opt => (
            <option key={opt.kind} value={opt.kind}>{opt.label}</option>
          ))}
        </Select>
      </FormField>
      <FormField label="Provider name">
        <Input
          placeholder="e.g. OpenAI Production"
          value={providerName}
          onChange={e => onNameChange(e.target.value)}
          onKeyDown={onKeyDown}
        />
      </FormField>
      <FormField label="Endpoint URL">
        <Input
          placeholder="https://api.openai.com/v1"
          value={providerEndpoint}
          onChange={e => onEndpointChange(e.target.value)}
          onKeyDown={onKeyDown}
        />
      </FormField>
      <FormField label="Upstream API key" error={error ?? undefined}>
        <Input
          type="password"
          placeholder="sk-..."
          value={providerApiKey}
          onChange={e => onApiKeyChange(e.target.value)}
          onKeyDown={onKeyDown}
          autoComplete="off"
        />
      </FormField>
      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={onTestConnection}
          disabled={!providerFilled || testing}
          loading={testing}
        >
          Test connection
        </Button>
        {testResult && (
          <span className={`text-[12px] ${testResult.ok ? 'text-success' : 'text-danger'}`}>
            {testResult.message}
          </span>
        )}
      </div>
      <p className="text-[11px] text-muted leading-relaxed">
        Stored encrypted. Used only to forward proxied requests upstream.
      </p>
    </div>
  );
}
