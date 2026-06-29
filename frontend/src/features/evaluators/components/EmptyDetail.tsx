import { Trans } from '@lingui/react/macro';
import { PlusIcon } from '../../../components/icons';
import { FlaskIcon } from '../../../components/icons';
import { Button } from '../../../components/ui/Button';

/** Placeholder shown in the detail pane when no evaluator is selected. */
export function EmptyDetail({ hasAny, onCreate }: { hasAny: boolean; onCreate: () => void }) {
  return (
    <div data-testid="evaluator-empty-detail" className="flex-1 flex flex-col items-center justify-center p-10 text-center text-muted gap-3.5">
      <div className="w-14 h-14 rounded-lg bg-card-2 flex items-center justify-center text-muted">
        <FlaskIcon size={24} />
      </div>
      <div>
        <div className="text-h2 font-semibold text-secondary">
          {hasAny ? <Trans>Select an evaluator</Trans> : <Trans>No evaluators yet</Trans>}
        </div>
        <div className="text-body mt-1 max-w-[320px]">
          {hasAny
            ? <Trans>Pick one from the list to view its definition, attached suites, and performance.</Trans>
            : <Trans>Create your first evaluator to start scoring agent responses.</Trans>}
        </div>
      </div>
      <Button variant="primary" className="mt-1" leftIcon={<PlusIcon size={13} />} onClick={onCreate}>
        <Trans>New evaluator</Trans>
      </Button>
    </div>
  );
}
