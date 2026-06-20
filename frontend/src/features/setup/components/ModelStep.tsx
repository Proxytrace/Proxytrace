import type { KeyboardEvent } from 'react';
import { Trans, Plural, useLingui } from '@lingui/react/macro';
import { FormField } from '../../../components/ui/FormField';
import { Button, IconButton } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Spinner } from '../../../components/ui/Spinner';
import { ResetIcon } from '../../../components/icons';

interface ModelStepProps {
  modelName: string;
  models: string[] | null;
  modelsLoading: boolean;
  modelsError: string | null;
  error: string | null;
  onModelChange: (v: string) => void;
  onReloadModels: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
}

export function ModelStep({
  modelName,
  models,
  modelsLoading,
  modelsError,
  error,
  onModelChange,
  onReloadModels,
  onKeyDown,
}: ModelStepProps) {
  const { t } = useLingui();
  return (
    <div className="flex flex-col gap-4">
      <FormField label={t`Default model`} error={error ?? undefined}>
        {modelsLoading ? (
          <div className="flex items-center gap-2.5 rounded-md border border-border bg-card-2 px-3 py-2">
            <Spinner size={12} />
            <span className="text-title text-secondary"><Trans>Discovering models from your provider…</Trans></span>
          </div>
        ) : models && models.length > 0 ? (
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Select value={modelName} onValueChange={onModelChange} autoFocus data-testid="setup-model-select">
                {models.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </Select>
            </div>
            <IconButton aria-label={t`Reload models`} onClick={onReloadModels} data-testid="setup-model-reload-btn">
              <ResetIcon size={14} />
            </IconButton>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {modelsError ? (
              <span className="text-body-sm text-danger leading-relaxed">
                <Trans>Could not list models from the provider: {modelsError}. Enter the model name manually.</Trans>
              </span>
            ) : models !== null ? (
              <span className="text-body-sm text-muted leading-relaxed">
                <Trans>No models were discovered — check the endpoint and API key, or enter the model name manually.</Trans>
              </span>
            ) : null}
            <Input
              placeholder={t`e.g. gpt-4o`}
              value={modelName}
              onChange={e => onModelChange(e.target.value)}
              onKeyDown={onKeyDown}
              autoFocus
              className="font-mono"
              data-testid="setup-model-input"
            />
            <Button variant="secondary" size="sm" className="self-start" onClick={onReloadModels}>
              <Trans>Retry discovery</Trans>
            </Button>
          </div>
        )}
      </FormField>

      {models && models.length > 0 && (
        <p className="text-body-sm text-muted -mt-2">
          <Plural value={models.length} one="# model discovered." other="# models discovered." />
        </p>
      )}

      <p className="text-body-sm text-muted leading-relaxed">
        <Trans>
          This becomes your project's default model. All discovered models are added with
          prices loaded automatically from the catalogue — nothing to type in.
        </Trans>
      </p>
    </div>
  );
}
