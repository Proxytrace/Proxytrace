import { cn } from '../../../lib/cn';
import { fmtRelative } from '../../../lib/format';
import { PlayFilledIcon, EditPencilIcon } from '../../../components/icons';
import { Button } from '../../../components/ui/Button';
import { TypeIconBox } from './TypeIconBox';
import type { EvaluatorDetailDto } from '../../../api/models';
import { KIND_CATEGORY, TYPE_META } from '../evaluatorMeta';
import { categoryHeaderWash, categoryText, categoryTint14 } from '../categoryClasses';

interface Props {
  evaluator: EvaluatorDetailDto;
  onEdit: () => void;
  onDelete: () => void;
  onTestBench: () => void;
}

/** Sticky detail header: identity, status pill, kind tag, and action buttons. */
export function WorkspaceHeader({ evaluator: e, onEdit, onDelete, onTestBench }: Props) {
  const cat = KIND_CATEGORY[e.kind];
  const m = TYPE_META[cat];
  return (
    <header className={cn('rounded-lg border border-subtle shadow-[var(--shadow-card)]', categoryHeaderWash[cat])}>
      <div className="flex items-center gap-3.5 px-[18px] py-3.5">
        <TypeIconBox category={cat} size={18} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-[19px] font-bold tracking-[-0.02em] m-0">{e.name}</h1>
            <span className="inline-flex items-center gap-[5px] px-2.5 py-[3px] rounded-full bg-success-subtle text-success text-[10.5px] font-semibold">
              <span className="pulse-dot w-[5px] h-[5px] rounded-full bg-success" />
              Active
            </span>
            <span className={cn('px-[9px] py-[3px] rounded-[5px] text-[10.5px] font-semibold', categoryTint14[cat], categoryText[cat])}>
              {m.label}
            </span>
          </div>
          <div className="flex gap-3.5 mt-[5px] text-[11px] text-muted flex-wrap font-mono">
            <span><span className="opacity-70">id</span> {e.id.slice(0, 12)}…</span>
            <span><span className="opacity-70">kind</span> {e.kind}</span>
            {e.endpointName && <span><span className="opacity-70">model</span> {e.endpointName}</span>}
            <span>
              <span className="opacity-70">updated</span>{' '}
              <span className="font-sans">{fmtRelative(e.updatedAt)}</span>
            </span>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="secondary" size="sm" leftIcon={<PlayFilledIcon size={11} />} onClick={onTestBench}>
            Test
          </Button>
          <Button
            variant="dangerOutline"
            size="sm"
            data-testid={`evaluator-delete-btn-${e.id}`}
            onClick={onDelete}
          >
            Delete
          </Button>
          <Button variant="primary" size="sm" leftIcon={<EditPencilIcon size={11} />} onClick={onEdit}>
            Edit
          </Button>
        </div>
      </div>
    </header>
  );
}
