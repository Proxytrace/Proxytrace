import { cn } from '../../../lib/cn';
import { fmtPct, fmtRelative } from '../../../lib/format';
import { Sparkline } from '../../../components/charts';
import type { EvaluatorDetailDto } from '../../../api/models';
import { KIND_CATEGORY, fmtScoreShort } from '../evaluatorMeta';
import { categoryBg, categorySelectedRow, categoryColorVar } from '../categoryClasses';
import { RowButton } from '../../../components/ui/RowButton';

interface Props {
  evaluator: EvaluatorDetailDto;
  isSelected: boolean;
  onSelect: (id: string) => void;
  sparkline?: number[];
  avgScore?: number | null;
}

/** A single evaluator entry in the left rail. */
export function EvaluatorRow({ evaluator: e, isSelected, onSelect, sparkline, avgScore }: Props) {
  const cat = KIND_CATEGORY[e.kind];
  return (
    <RowButton
      onClick={() => onSelect(e.id)}
      data-testid={`evaluator-rail-item-${e.id}`}
      className={cn(
        'flex items-center gap-2.5 px-2.5 py-[9px] rounded-[9px] transition-colors',
        isSelected ? categorySelectedRow[cat] : 'bg-transparent hover:bg-card-2',
      )}
    >
      <span className={cn('w-[3px] self-stretch rounded-full shrink-0', isSelected ? categoryBg[cat] : 'bg-transparent')} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="pulse-dot w-[5px] h-[5px] rounded-full bg-success shrink-0" />
          <span className="text-[12.5px] font-semibold text-primary overflow-hidden text-ellipsis whitespace-nowrap">{e.name}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-[3px] text-[10.5px] text-muted font-mono">
          <span className={avgScore == null ? 'text-muted' : 'text-secondary'}>
            {fmtScoreShort(avgScore ?? null, e.kind, fmtPct)}
          </span>
          <span className="opacity-40">·</span>
          <span>{fmtRelative(e.updatedAt)}</span>
        </div>
      </div>
      {sparkline && sparkline.length >= 2 && (
        <Sparkline data={sparkline} color={categoryColorVar[cat]} width={42} height={16} strokeWidth={1.3} />
      )}
    </RowButton>
  );
}
