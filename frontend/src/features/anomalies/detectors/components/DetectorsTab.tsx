import { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { PlusIcon } from '../../../../components/icons';
import { Button } from '../../../../components/ui/Button';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { SkeletonList } from '../../../../components/ui/Skeleton';
import { ConfirmDialog } from '../../../../components/overlays/ConfirmDialog';
import useToast from '../../../../hooks/useToast';
import type { CustomAnomalyDetectorDto } from '../../../../api/models';
import { useDetectors } from '../hooks/useDetectors';
import { useDetectorMutations } from '../hooks/useDetectorMutations';
import { DetectorList } from './DetectorList';
import { DetectorFormModal } from './DetectorFormModal';

/** Detectors tab: lists the project's custom anomaly detectors with create / edit / delete. Mounted
 * behind `RequiresFeature` (Enterprise), so this body assumes the feature is licensed. */
export function DetectorsTab() {
  const { t } = useLingui();
  const { show: toast } = useToast();
  const { detectors, isLoading, isError } = useDetectors();
  const { remove } = useDetectorMutations();

  // undefined = form closed; null = creating; a detector = editing it.
  const [formTarget, setFormTarget] = useState<CustomAnomalyDetectorDto | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<CustomAnomalyDetectorDto | null>(null);

  function confirmDelete() {
    if (!deleting) return;
    remove.mutate(deleting.id, {
      onSuccess: () => {
        // eslint-disable-next-line lingui/no-unlocalized-strings -- toast tone token, not UI copy
        toast(t`Detector deleted`, 'success');
        setDeleting(null);
      },
    });
  }

  return (
    <div className="flex flex-col gap-4" data-testid="detectors-tab">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-body-sm text-muted">
          <Trans>Custom LLM detectors review matched calls and flag anomalies beyond the built-in statistical checks.</Trans>
        </p>
        <Button leftIcon={<PlusIcon size={15} />} onClick={() => setFormTarget(null)} data-testid="detector-create-btn">
          <Trans>New detector</Trans>
        </Button>
      </div>

      {isLoading && <SkeletonList rows={3} height={64} />}

      {!isLoading && isError && (
        <p className="text-body-sm text-danger py-6 text-center" data-testid="detectors-error">
          <Trans>Couldn't load detectors.</Trans>
        </p>
      )}

      {!isLoading && !isError && detectors.length === 0 && (
        <div data-testid="detector-empty-state">
          <EmptyState
            title={t`No detectors yet`}
            description={t`Create a detector to review calls with an LLM and flag custom anomalies.`}
            action={
              <Button leftIcon={<PlusIcon size={15} />} onClick={() => setFormTarget(null)}>
                <Trans>New detector</Trans>
              </Button>
            }
          />
        </div>
      )}

      {!isLoading && !isError && detectors.length > 0 && (
        <DetectorList detectors={detectors} onEdit={setFormTarget} onDelete={setDeleting} />
      )}

      {formTarget !== undefined && (
        <DetectorFormModal detector={formTarget} onClose={() => setFormTarget(undefined)} />
      )}

      {deleting && (
        <ConfirmDialog
          displayName={deleting.name}
          message={t`This removes the detector and its review history. This can't be undone.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
          loading={remove.isPending}
        />
      )}
    </div>
  );
}
