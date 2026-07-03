import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { EditPencilIcon, TrashIcon } from '../../../../components/icons';
import { IconButton } from '../../../../components/ui/Button';
import { Card } from '../../../../components/ui/Card';
import { cn } from '../../../../lib/cn';
import type { CustomAnomalyDetectorDto } from '../../../../api/models';

interface Props {
  detectors: CustomAnomalyDetectorDto[];
  onEdit: (detector: CustomAnomalyDetectorDto) => void;
  onDelete: (detector: CustomAnomalyDetectorDto) => void;
}

export function DetectorList({ detectors, onEdit, onDelete }: Props) {
  const { t } = useLingui();

  return (
    <div className="flex flex-col gap-2" data-testid="detector-list">
      {detectors.map(d => (
        <Card key={d.id} elevation="flat" padding="md" data-testid={`detector-row-${d.id}`}>
          <div className="flex items-center gap-3">
            <span
              className={cn('w-2 h-2 rounded-full shrink-0', d.isEnabled ? 'bg-success' : 'bg-muted')}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-title font-semibold text-primary truncate" data-testid={`detector-name-${d.id}`}>{d.name}</span>
                {!d.isEnabled && (
                  <span className="text-caption text-muted shrink-0"><Trans>Disabled</Trans></span>
                )}
              </div>
              <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 text-body-sm text-muted mt-0.5">
                <span className="font-mono truncate">{d.endpointName}</span>
                <span><Plural value={d.triggers.length} one="# trigger" other="# triggers" /></span>
                <span>
                  {d.allAgents
                    ? <Trans>All agents</Trans>
                    : <Plural value={d.agentIds.length} one="# agent" other="# agents" />}
                </span>
              </div>
            </div>
            <IconButton onClick={() => onEdit(d)} title={t`Edit detector`} aria-label={t`Edit detector`} data-testid={`detector-edit-btn-${d.id}`} data-write>
              <EditPencilIcon size={15} />
            </IconButton>
            <IconButton onClick={() => onDelete(d)} title={t`Delete detector`} aria-label={t`Delete detector`} data-testid={`detector-delete-btn-${d.id}`} data-write>
              <TrashIcon size={15} />
            </IconButton>
          </div>
        </Card>
      ))}
    </div>
  );
}
