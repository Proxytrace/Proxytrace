import type { KeyboardEvent } from 'react';
import { FormField } from '../../../components/ui/FormField';
import { CodeBlock } from '../../../components/ui/CodeBlock';
import { CheckIcon } from '../../../components/icons';
import { formInputCls } from '../../../components/ui/classes';

interface ApiKeyStepProps {
  done: boolean;
  apiKeyValue: string | null;
  keyName: string;
  error: string | null;
  onKeyNameChange: (v: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
}

export function ApiKeyStep({ done, apiKeyValue, keyName, error, onKeyNameChange, onKeyDown }: ApiKeyStepProps) {
  if (done && apiKeyValue) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-3 p-4 rounded-xl bg-[var(--success-subtle)] border border-[color:var(--success)]/30">
          <div className="w-8 h-8 rounded-full bg-success flex items-center justify-center shrink-0 mt-px">
            <CheckIcon size={16} strokeWidth={2.5} className="text-white" />
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="text-[14px] font-semibold text-primary">Setup complete</div>
            <div className="text-[12px] text-secondary leading-relaxed">
              Save the key below — it's shown once and cannot be retrieved later.
            </div>
          </div>
        </div>
        <CodeBlock
          heading="Your Trsr API key"
          content={apiKeyValue}
          maxLines={1}
        />
        <CodeBlock
          heading="Proxy endpoint usage"
          content={`POST http://localhost:5001/openai/v1/chat/completions\nAuthorization: Bearer ${apiKeyValue}\nContent-Type: application/json`}
          maxLines={5}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <FormField label="Key name" error={error ?? undefined}>
        <input
          className={formInputCls}
          placeholder="default"
          value={keyName}
          onChange={e => onKeyNameChange(e.target.value)}
          onKeyDown={onKeyDown}
          autoFocus
        />
      </FormField>
      <p className="text-[11px] text-muted leading-relaxed">
        Use this key in your application instead of your upstream provider key.
        Trsr will forward the request and record the trace.
      </p>
    </div>
  );
}
