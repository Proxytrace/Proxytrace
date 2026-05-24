import { useState } from 'react';
import type { ModelEndpointDto } from '../../../api/models';
import { Button, IconButton } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/overlays/ConfirmDialog';
import { EmptyState } from '../../../components/ui/EmptyState';
import { FormField } from '../../../components/ui/FormField';
import { SkeletonList } from '../../../components/ui/Skeleton';
import { EditIcon, PlusIcon, TrashIcon } from '../../../components/icons';
import { formInputCls } from '../../../components/ui/classes';
import { useAvailableModels, useProviderModels } from '../hooks/useProviderQueries';
import { useCreateModel, useDeleteModel, useUpdateModelPricing } from '../hooks/useProviderMutations';

const GRID = 'grid grid-cols-[2fr_1fr_1fr_auto]';

interface ModelsTabProps {
  providerId: string;
}

export function ModelsTab({ providerId }: ModelsTabProps) {
  const { data: models = [], isLoading } = useProviderModels(providerId);
  const [showNew, setShowNew] = useState(false);
  const [newModel, setNewModel] = useState({ modelName: '', inputTokenCost: '', outputTokenCost: '' });
  const [editing, setEditing] = useState<ModelEndpointDto | null>(null);
  const [editPricing, setEditPricing] = useState({ inputTokenCost: '', outputTokenCost: '' });
  const [toDelete, setToDelete] = useState<ModelEndpointDto | null>(null);

  const { data: availableModels, isLoading: availableLoading, error: availableError } = useAvailableModels(providerId, showNew);
  const existingNames = new Set(models.map(m => m.modelName));
  const selectable = (availableModels ?? []).filter(n => !existingNames.has(n));

  const createModel = useCreateModel(providerId);
  const deleteModel = useDeleteModel(providerId);
  const updatePricing = useUpdateModelPricing(providerId);

  function submitNew() {
    createModel.mutate(
      {
        modelName: newModel.modelName,
        inputTokenCost: newModel.inputTokenCost ? parseFloat(newModel.inputTokenCost) : null,
        outputTokenCost: newModel.outputTokenCost ? parseFloat(newModel.outputTokenCost) : null,
      },
      { onSuccess: () => { setShowNew(false); setNewModel({ modelName: '', inputTokenCost: '', outputTokenCost: '' }); } },
    );
  }

  function submitPricing(endpointId: string) {
    updatePricing.mutate(
      {
        endpointId,
        req: {
          inputTokenCost: editPricing.inputTokenCost ? parseFloat(editPricing.inputTokenCost) : null,
          outputTokenCost: editPricing.outputTokenCost ? parseFloat(editPricing.outputTokenCost) : null,
        },
      },
      { onSuccess: () => setEditing(null) },
    );
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-h2 font-semibold text-primary mb-0.5">Models</div>
          <div className="text-body-sm text-muted">Set pricing to compute trace costs.</div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<PlusIcon size={13} />}
          onClick={() => { setShowNew(true); setEditing(null); setNewModel({ modelName: '', inputTokenCost: '', outputTokenCost: '' }); }}
        >
          Add model
        </Button>
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
                <input value={newModel.modelName} onChange={e => setNewModel(m => ({ ...m, modelName: e.target.value }))} placeholder="e.g. claude-sonnet-4-5" className={`${formInputCls} font-mono`} />
              </div>
            ) : selectable.length === 0 ? (
              <div className="text-body text-muted py-2">All discovered models are already added.</div>
            ) : (
              <select value={newModel.modelName} onChange={e => setNewModel(m => ({ ...m, modelName: e.target.value }))} className={`${formInputCls} font-mono`}>
                <option value="">Select a model…</option>
                {selectable.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
            )}
          </FormField>
          <div className="grid grid-cols-2 gap-2.5">
            <FormField label="Input cost / 1M tokens (€)">
              <input type="number" value={newModel.inputTokenCost} onChange={e => setNewModel(m => ({ ...m, inputTokenCost: e.target.value }))} placeholder="e.g. 3.00" className={formInputCls} />
            </FormField>
            <FormField label="Output cost / 1M tokens (€)">
              <input type="number" value={newModel.outputTokenCost} onChange={e => setNewModel(m => ({ ...m, outputTokenCost: e.target.value }))} placeholder="e.g. 15.00" className={formInputCls} />
            </FormField>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button data-write variant="primary" size="sm" loading={createModel.isPending} disabled={!newModel.modelName} onClick={submitNew}>
              Add model
            </Button>
          </div>
        </div>
      )}

      {isLoading && <SkeletonList rows={3} height={48} gap={8} />}
      {!isLoading && models.length === 0 && !showNew && (
        <EmptyState title="No models yet" description="Add one or let Trsr auto-discover them from traces." />
      )}
      {models.length > 0 && (
        <div className="bg-card-2 rounded-lg border border-hairline overflow-hidden">
          <div className={`${GRID} px-4 py-2.5 text-caption font-semibold text-muted tracking-[0.07em] uppercase border-b border-hairline`}>
            <span>Model</span><span>Input / 1M €</span><span>Output / 1M €</span><span />
          </div>
          {models.map((m, i) => (
            <div key={m.id} className={i < models.length - 1 ? 'border-b border-hairline' : ''}>
              <div className={`${GRID} px-4 py-2.5 items-center`}>
                <span className="font-mono text-body text-primary">{m.modelName}</span>
                <span className="text-body text-secondary">{m.inputTokenCost != null ? m.inputTokenCost.toFixed(4) : '—'}</span>
                <span className="text-body text-secondary">{m.outputTokenCost != null ? m.outputTokenCost.toFixed(4) : '—'}</span>
                <div className="flex items-center gap-1">
                  <IconButton aria-label="Edit pricing" onClick={() => { setEditing(m); setEditPricing({ inputTokenCost: m.inputTokenCost?.toString() ?? '', outputTokenCost: m.outputTokenCost?.toString() ?? '' }); setShowNew(false); }}>
                    <EditIcon size={13} />
                  </IconButton>
                  <IconButton aria-label="Delete model" danger onClick={() => setToDelete(m)}>
                    <TrashIcon size={13} />
                  </IconButton>
                </div>
              </div>
              {editing?.id === m.id && (
                <div className="px-4 py-3.5 bg-card border-t border-hairline flex flex-col gap-3">
                  <div className="text-body-sm font-semibold text-secondary">Edit pricing for <span className="font-mono text-primary">{m.modelName}</span></div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <FormField label="Input / 1M (€)">
                      <input type="number" value={editPricing.inputTokenCost} onChange={e => setEditPricing(p => ({ ...p, inputTokenCost: e.target.value }))} placeholder="not set" className={formInputCls} />
                    </FormField>
                    <FormField label="Output / 1M (€)">
                      <input type="number" value={editPricing.outputTokenCost} onChange={e => setEditPricing(p => ({ ...p, outputTokenCost: e.target.value }))} placeholder="not set" className={formInputCls} />
                    </FormField>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
                    <Button data-write variant="primary" size="sm" loading={updatePricing.isPending} onClick={() => submitPricing(m.id)}>Save</Button>
                  </div>
                </div>
              )}
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
