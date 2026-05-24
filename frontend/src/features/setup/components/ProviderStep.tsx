import type { KeyboardEvent } from 'react';
import { FormField } from '../../../components/ui/FormField';
import { ChevronDownIcon } from '../../../components/icons';
import { formInputCls } from '../../../components/ui/classes';
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
        <div className="relative">
          <select
            className={`${formInputCls} appearance-none pr-9 cursor-pointer`}
            value={providerKind}
            onChange={e => onKindChange(e.target.value as ModelProviderKind)}
          >
            {PROVIDER_KIND_OPTIONS.map(opt => (
              <option key={opt.kind} value={opt.kind}>{opt.label}</option>
            ))}
          </select>
          <ChevronDownIcon
            size={16}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
          />
        </div>
      </FormField>
      <FormField label="Provider name">
        <input
          className={formInputCls}
          placeholder="e.g. Anthropic Production"
          value={providerName}
          onChange={e => onNameChange(e.target.value)}
          onKeyDown={onKeyDown}
        />
      </FormField>
      <FormField label="Endpoint URL">
        <input
          className={formInputCls}
          placeholder="https://api.anthropic.com/v1"
          value={providerEndpoint}
          onChange={e => onEndpointChange(e.target.value)}
          onKeyDown={onKeyDown}
        />
      </FormField>
      <FormField label="Upstream API key" error={error ?? undefined}>
        <input
          className={formInputCls}
          type="password"
          placeholder="sk-..."
          value={providerApiKey}
          onChange={e => onApiKeyChange(e.target.value)}
          onKeyDown={onKeyDown}
          autoComplete="off"
        />
      </FormField>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onTestConnection}
          disabled={!providerFilled || testing}
          className="cursor-pointer text-[12px] font-medium px-3 py-[9px] rounded-[9px] border border-border bg-card-2 text-secondary hover:text-primary hover:border-[color:var(--hairline)] transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {testing ? 'Testing…' : 'Test connection'}
        </button>
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
