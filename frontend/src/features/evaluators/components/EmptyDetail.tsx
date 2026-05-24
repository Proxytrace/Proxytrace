import { PlusIcon } from '../../../components/icons';
import { FlaskIcon } from '../../../components/icons';

/** Placeholder shown in the detail pane when no evaluator is selected. */
export function EmptyDetail({ hasAny, onCreate }: { hasAny: boolean; onCreate: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-10 text-center text-muted gap-3.5">
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
      <button
        onClick={onCreate}
        data-write
        className="mt-1 px-4 py-[9px] rounded-md text-[13px] font-semibold text-white border-0 inline-flex items-center gap-[7px] cursor-pointer bg-[image:var(--grad-accent)] shadow-[var(--shadow-btn)]"
      >
        <PlusIcon size={13} /> New evaluator
      </button>
    </div>
  );
}
