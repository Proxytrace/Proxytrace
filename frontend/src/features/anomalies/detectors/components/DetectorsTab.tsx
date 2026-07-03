import { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { ConfirmDialog } from '../../../../components/overlays/ConfirmDialog';
import { LIST_RAIL_COLS } from '../../../../components/ui/ListRail';
import { useSelectedId } from '../../../../hooks/useSelectedId';
import useToast from '../../../../hooks/useToast';
import type { CustomAnomalyDetectorDto } from '../../../../api/models';
import { buildUpdatePayload, formFromDetector } from '../detectors';
import { useDetectors } from '../hooks/useDetectors';
import { useDetectorMutations } from '../hooks/useDetectorMutations';
import { DetectorRail } from './DetectorRail';
import { DetectorDetail } from './DetectorDetail';
import { EmptyDetectorDetail } from './EmptyDetectorDetail';
import { DetectorFormModal } from './DetectorFormModal';

/** Detectors tab: master/detail over the project's custom anomaly detectors — rail on the left,
 * the selected detector's instructions/triggers/scope on the right. Mounted behind
 * `RequiresFeature` (Enterprise), so this body assumes the feature is licensed. */
export function DetectorsTab() {
  const { t } = useLingui();
  const { show: toast } = useToast();
  const { detectors, isLoading, isError } = useDetectors();
  const { update, remove } = useDetectorMutations();
  const [selectedId, setSelectedId] = useSelectedId();

  // undefined = form closed; null = creating; a detector = editing it.
  const [formTarget, setFormTarget] = useState<CustomAnomalyDetectorDto | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<CustomAnomalyDetectorDto | null>(null);

  const effectiveId = (selectedId && detectors.some(d => d.id === selectedId))
    ? selectedId
    : detectors[0]?.id ?? null;
  const selected = detectors.find(d => d.id === effectiveId) ?? null;

  function toggleEnabled(d: CustomAnomalyDetectorDto, next: boolean) {
    update.mutate(
      { id: d.id, request: buildUpdatePayload({ ...formFromDetector(d), isEnabled: next }) },
      {
        onSuccess: () => {
          // eslint-disable-next-line lingui/no-unlocalized-strings -- toast tone token, not UI copy
          toast(next ? t`Detector enabled` : t`Detector disabled`, 'success');
        },
      },
    );
  }

  function confirmDelete() {
    if (!deleting) return;
    const targetId = deleting.id;
    remove.mutate(targetId, {
      onSuccess: () => {
        // eslint-disable-next-line lingui/no-unlocalized-strings -- toast tone token, not UI copy
        toast(t`Detector deleted`, 'success');
        if (selectedId === targetId) setSelectedId(null);
        setDeleting(null);
      },
    });
  }

  if (isError) {
    return (
      <p className="text-body-sm text-danger py-6 text-center" data-testid="detectors-error">
        <Trans>Couldn't load detectors.</Trans>
      </p>
    );
  }

  return (
    <div className={`flex-1 grid ${LIST_RAIL_COLS} gap-3.5 min-h-0`} data-testid="detectors-tab">
      <DetectorRail
        detectors={detectors}
        isLoading={isLoading}
        selectedId={effectiveId}
        onSelect={setSelectedId}
        onNew={() => setFormTarget(null)}
      />

      <main className="min-w-0 overflow-y-auto flex flex-col">
        {selected ? (
          <DetectorDetail
            detector={selected}
            onEdit={() => setFormTarget(selected)}
            onDelete={() => setDeleting(selected)}
            onToggleEnabled={next => toggleEnabled(selected, next)}
            toggling={update.isPending}
          />
        ) : (
          !isLoading && <EmptyDetectorDetail hasAny={detectors.length > 0} onCreate={() => setFormTarget(null)} />
        )}
      </main>

      {formTarget !== undefined && (
        <DetectorFormModal
          detector={formTarget}
          onClose={() => setFormTarget(undefined)}
          onSaved={setSelectedId}
        />
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
