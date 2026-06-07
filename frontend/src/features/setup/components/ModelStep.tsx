import type { KeyboardEvent } from 'react';
import { FormField } from '../../../components/ui/FormField';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';

interface ModelStepProps {
  modelName: string;
  inputCost: string;
  outputCost: string;
  models: string[] | null;
  modelsLoading: boolean;
  modelsError: string | null;
  error: string | null;
  onModelChange: (v: string) => void;
  onInputCostChange: (v: string) => void;
  onOutputCostChange: (v: string) => void;
  onLoadModels: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
}

export function ModelStep({
  modelName,
  inputCost,
  outputCost,
  models,
  modelsLoading,
  modelsError,
  error,
  onModelChange,
  onInputCostChange,
  onOutputCostChange,
  onLoadModels,
  onKeyDown,
}: ModelStepProps) {
  return (
    <div className="flex flex-col gap-4">
      <FormField label="Model" error={error ?? undefined}>
        {modelsLoading ? (
          <Input value="Loading models…" disabled readOnly />
        ) : models && models.length > 0 ? (
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Select value={modelName} onChange={e => onModelChange(e.target.value)} autoFocus>
                {models.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </Select>
            </div>
            <Button variant="secondary" size="sm" onClick={onLoadModels}>Refresh</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Input
              placeholder="e.g. claude-sonnet-4-5"
              value={modelName}
              onChange={e => onModelChange(e.target.value)}
              onKeyDown={onKeyDown}
              autoFocus
            />
            {modelsError && (
              <span className="text-[11px] text-danger">
                Could not list models from provider: {modelsError}. Enter the model name manually.
              </span>
            )}
            <Button variant="secondary" size="sm" className="self-start" onClick={onLoadModels}>
              Retry loading models
            </Button>
          </div>
        )}
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Input cost / 1M tokens">
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="3.00"
            leftAddon="$"
            value={inputCost}
            onChange={e => onInputCostChange(e.target.value)}
            onKeyDown={onKeyDown}
          />
        </FormField>
        <FormField label="Output cost / 1M tokens">
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="15.00"
            leftAddon="$"
            value={outputCost}
            onChange={e => onOutputCostChange(e.target.value)}
            onKeyDown={onKeyDown}
          />
        </FormField>
      </div>
      <p className="text-[11px] text-muted leading-relaxed">
        Costs are optional but enable per-call spend tracking and ROI proposals.
      </p>
    </div>
  );
}
