import { useState } from 'react';
import type { ModelEndpointDto } from '../../../api/models';
import { Button, IconButton } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/overlays/ConfirmDialog';
import { EmptyState } from '../../../components/ui/EmptyState';
import { FormField } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { PlusIcon, TrashIcon } from '../../../components/icons';
import { useAvailableModels } from '../hooks/useProviderQueries';
import { useCreateModel, useDeleteModel } from '../hooks/useProviderMutations';

const GRID = 'grid grid-cols-[2fr_1fr_1fr_auto]';

interface ModelsSectionProps {
  providerId: string;
  models: ModelEndpointDto[];
  reloading: boolean;
  onReload: () => void;
}

export function ModelsSection({ providerId, models, reloading, onReload }: ModelsSectionProps) {
  const [showNew, setShowNew] = useState(false);
  const [newModelName, setNewModelName] = useState('');
  const [toDelete, setToDelete] = useState<ModelEndpointDto | null>(null);

  const { data: availableModels, isLoading: availableLoading, error: availableError } = useAvailableModels(providerId, showNew);
  const existingNames = new Set(models.map(m => m.modelName));
  const selectable = (availableModels ?? []).filter(n => !existingNames.has(n));

  const createModel = useCreateModel(providerId);
  const deleteModel = useDeleteModel();

  function submitNew() {
    createModel.mutate(
      { modelName: newModelName, inputTokenCost: null, outputTokenCost: null },
      { onSuccess: () => { setShowNew(false); setNewModelName(''); } },
    );
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-h2 font-semibold text-primary mb-0.5">Models</div>
          <div className="text-body-sm text-muted">Prices load automatically; reload to refresh them.</div>
        </div>
        <div className="flex items-center gap-2">
          <Button data-testid="model-reload-btn" variant="ghost" size="sm" loading={reloading} onClick={() => onReload()}>
            Reload models &amp; prices
          </Button>
          <Button
            data-testid="model-add-btn"
            variant="secondary"
            size="sm"
            leftIcon={<PlusIcon size={13} />}
            onClick={() => { setShowNew(true); setNewModelName(''); }}
          >
            Add model
          </Button>
        </div>
      </div>

      {showNew && (
        <div className="p-4 bg-card-2 rounded-lg border border-hairline flex flex-col gap-3">
          <div className="text-title font-semibold text-primary">Add model</div>
          <FormField label="Model">
            {availableLoading ? (
              <div className="text-body text-muted py-2">Discovering available models…</div>
            ) : availableError ? (
              <div className="flex flex-col gap-1.5">
                <div className="text-body text-danger">Could not discover models from endpoint. Enter manually:</div>
                <Input data-testid="model-name-input" value={newModelName} onChange={e => setNewModelName(e.target.value)} placeholder="e.g. claude-sonnet-4-5" className="font-mono" />
              </div>
            ) : selectable.length === 0 ? (
              <div className="text-body text-muted py-2">All discovered models are already added.</div>
            ) : (
              <Select data-testid="model-name-select" value={newModelName} onChange={e => setNewModelName(e.target.value)} className="font-mono">
                <option value="">Select a model…</option>
                {selectable.map(name => <option key={name} value={name}>{name}</option>)}
              </Select>
            )}
          </FormField>
          <div className="text-body-sm text-muted">Pricing is fetched automatically — use “Reload models &amp; prices” after adding.</div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button data-testid="model-add-submit" data-write variant="primary" size="sm" loading={createModel.isPending} disabled={!newModelName} onClick={submitNew}>
              Add model
            </Button>
          </div>
        </div>
      )}

      {models.length === 0 && !showNew && (
        <EmptyState title="No models yet" description="Add one or let Proxytrace auto-discover them from traces." />
      )}
      {models.length > 0 && (
        <div className="bg-card-2 rounded-lg border border-hairline overflow-hidden">
          <div className={`${GRID} px-4 py-2.5 text-caption font-semibold text-muted tracking-[0.07em] uppercase border-b border-hairline`}>
            <span>Model</span><span>Input / 1M €</span><span>Output / 1M €</span><span />
          </div>
          {models.map((m, i) => (
            <div key={m.id} data-testid={`model-row-${m.id}`} className={i < models.length - 1 ? 'border-b border-hairline' : ''}>
              <div className={`${GRID} px-4 py-2.5 items-center`}>
                <span className="font-mono text-body text-primary">{m.modelName}</span>
                <span className="text-body text-secondary">{m.inputTokenCost != null ? m.inputTokenCost.toFixed(4) : '—'}</span>
                <span className="text-body text-secondary">{m.outputTokenCost != null ? m.outputTokenCost.toFixed(4) : '—'}</span>
                <div className="flex items-center gap-1">
                  <IconButton aria-label="Delete model" danger onClick={() => setToDelete(m)}>
                    <TrashIcon size={13} />
                  </IconButton>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {toDelete && (
        <ConfirmDialog
          entityName={toDelete.modelName}
          onConfirm={() => deleteModel.mutate(toDelete.id, { onSuccess: () => setToDelete(null) })}
          onCancel={() => setToDelete(null)}
          loading={deleteModel.isPending}
        />
      )}
    </>
  );
}
