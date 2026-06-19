import { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import type { ModelEndpointDto } from '../../../api/models';
import { Button, IconButton } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/overlays/ConfirmDialog';
import { EmptyState } from '../../../components/ui/EmptyState';
import { TrashIcon } from '../../../components/icons';
import { cn } from '../../../lib/cn';
import { useDeleteModel } from '../hooks/useProviderMutations';

const GRID = cn('grid grid-cols-[2fr_1fr_1fr_auto]');

interface ModelsSectionProps {
  providerId: string;
  models: ModelEndpointDto[];
  reloading: boolean;
  onReload: () => void;
}

export function ModelsSection({ models, reloading, onReload }: ModelsSectionProps) {
  const { t } = useLingui();
  const [toDelete, setToDelete] = useState<ModelEndpointDto | null>(null);
  const deleteModel = useDeleteModel();

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-h2 font-semibold text-primary mb-0.5"><Trans>Models</Trans></div>
          <div className="text-body-sm text-muted"><Trans>Pulled from the provider; prices load automatically.</Trans></div>
        </div>
        <Button data-testid="model-reload-btn" variant="ghost" size="sm" loading={reloading} onClick={() => onReload()}>
          <Trans>Reload models &amp; prices</Trans>
        </Button>
      </div>

      {models.length === 0 && (
        <EmptyState title={t`No models yet`} description={t`Reload to pull this provider's models, or let Proxytrace auto-discover them from traces.`} />
      )}
      {models.length > 0 && (
        <div className="bg-card-2 rounded-lg border border-hairline overflow-hidden">
          <div className={`${GRID} px-4 py-2.5 text-caption font-semibold text-muted tracking-[0.07em] uppercase border-b border-hairline`}>
            <span><Trans>Model</Trans></span><span><Trans>Input / 1M €</Trans></span><span><Trans>Output / 1M €</Trans></span><span />
          </div>
          {models.map((m, i) => (
            <div key={m.id} data-testid={`model-row-${m.id}`} className={i < models.length - 1 ? 'border-b border-hairline' : ''}>
              <div className={`${GRID} px-4 py-2.5 items-center`}>
                <span className="font-mono text-body text-primary">{m.modelName}</span>
                <span className="text-body text-secondary">{m.inputTokenCost != null ? m.inputTokenCost.toFixed(4) : '—'}</span>
                <span className="text-body text-secondary">{m.outputTokenCost != null ? m.outputTokenCost.toFixed(4) : '—'}</span>
                <div className="flex items-center gap-1">
                  <IconButton aria-label={t`Delete model`} danger onClick={() => setToDelete(m)}>
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
