import type { KeyboardEvent } from 'react';
import { FormField } from '../../../components/ui/FormField';
import { ChevronDownIcon } from '../../../components/icons';
import { formInputCls } from '../../../components/ui/classes';

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
          <input
            className={formInputCls}
            value="Loading models…"
            disabled
            readOnly
          />
        ) : models && models.length > 0 ? (
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <select
                className={`${formInputCls} appearance-none pr-9 cursor-pointer`}
                value={modelName}
                onChange={e => onModelChange(e.target.value)}
                autoFocus
              >
                {models.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <ChevronDownIcon
                size={16}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
              />
            </div>
            <button
              type="button"
              onClick={onLoadModels}
              className="cursor-pointer text-[12px] font-medium px-3 py-[9px] rounded-[9px] border border-border bg-card-2 text-secondary hover:text-primary hover:border-[color:var(--hairline)] transition-colors duration-150"
            >
              Refresh
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <input
              className={formInputCls}
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
            <button
              type="button"
              onClick={onLoadModels}
              className="self-start cursor-pointer text-[11px] font-medium px-2 py-1 rounded-md border border-border bg-card-2 text-secondary hover:text-primary transition-colors duration-150"
            >
              Retry loading models
            </button>
          </div>
        )}
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Input cost / 1M tokens">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-muted pointer-events-none">$</span>
            <input
              className={`${formInputCls} pl-6`}
              type="number"
              min="0"
              step="0.01"
              placeholder="3.00"
              value={inputCost}
              onChange={e => onInputCostChange(e.target.value)}
              onKeyDown={onKeyDown}
            />
          </div>
        </FormField>
        <FormField label="Output cost / 1M tokens">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-muted pointer-events-none">$</span>
            <input
              className={`${formInputCls} pl-6`}
              type="number"
              min="0"
              step="0.01"
              placeholder="15.00"
              value={outputCost}
              onChange={e => onOutputCostChange(e.target.value)}
              onKeyDown={onKeyDown}
            />
          </div>
        </FormField>
      </div>
      <p className="text-[11px] text-muted leading-relaxed">
        Costs are optional but enable per-call spend tracking and ROI proposals.
      </p>
    </div>
  );
}
