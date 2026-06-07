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
        <div className="text-[14px] font-semibold text-secondary">
          {hasAny ? 'Select an evaluator' : 'No evaluators yet'}
        </div>
        <div className="text-[12px] mt-1 max-w-[320px]">
          {hasAny
            ? 'Pick one from the list to view its definition, attached suites, and performance.'
            : 'Create your first evaluator to start scoring agent responses.'}
        </div>
      </div>
      <Button variant="primary" className="mt-1" leftIcon={<PlusIcon size={13} />} onClick={onCreate}>
        New evaluator
      </Button>
    </div>
  );
}
