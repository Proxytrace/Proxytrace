import { Trans } from '@lingui/react/macro';
import { PlusIcon, TargetIcon } from '../../../../components/icons';
import { Button } from '../../../../components/ui/Button';

/** Placeholder shown in the detail pane when no detector is selected. */
export function EmptyDetectorDetail({ hasAny, onCreate }: { hasAny: boolean; onCreate: () => void }) {
  return (
    <div data-testid="detector-empty-state" className="flex-1 flex flex-col items-center justify-center p-10 text-center text-muted gap-3.5">
      <div className="w-14 h-14 rounded-lg bg-card-2 flex items-center justify-center text-muted">
        <TargetIcon size={24} />
      </div>
      <div>
        <div className="text-h2 font-semibold text-secondary">
          {hasAny ? <Trans>Select a detector</Trans> : <Trans>No detectors yet</Trans>}
        </div>
        <div className="text-body mt-1 max-w-[360px]">
          {hasAny
            ? <Trans>Pick one from the list to view its instructions, triggers, and agent scope.</Trans>
            : <Trans>Custom detectors review matched calls with an LLM judge and flag anomalies beyond the built-in statistical checks.</Trans>}
        </div>
      </div>
      <Button variant="primary" className="mt-1" leftIcon={<PlusIcon size={13} />} onClick={onCreate} data-testid="detector-empty-create-btn">
        <Trans>New detector</Trans>
      </Button>
    </div>
  );
}
