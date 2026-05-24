import { cn } from '../../../lib/cn';
import type { EvaluatorKind } from '../../../api/models';
import { KIND_CATEGORY, META, type TypeCategory } from '../evaluatorMeta';
import { categoryText, categoryTint14 } from '../categoryClasses';
import { CategoryIcon } from './evaluatorIcons';

/** Per-category hover recipe for the kind picker cards (wash + border tint). */
const HOVER: Record<TypeCategory, string> = {
  llm: 'hover:bg-[color-mix(in_srgb,var(--accent-primary)_10%,var(--bg-card-2))] hover:border-[color-mix(in_srgb,var(--accent-primary)_44%,transparent)]',
  rule: 'hover:bg-[color-mix(in_srgb,var(--teal)_10%,var(--bg-card-2))] hover:border-[color-mix(in_srgb,var(--teal)_44%,transparent)]',
  numeric: 'hover:bg-[color-mix(in_srgb,var(--teal)_10%,var(--bg-card-2))] hover:border-[color-mix(in_srgb,var(--teal)_44%,transparent)]',
};

/** A selectable evaluator-kind card in the create modal's first step. */
export function KindPickerCard({ kind, onPick }: { kind: EvaluatorKind; onPick: (k: EvaluatorKind) => void }) {
  const cat = KIND_CATEGORY[kind];
  const meta = META[kind];
  return (
    <button
      onClick={() => onPick(kind)}
      className={cn(
        'text-left p-3.5 rounded-lg flex gap-3 cursor-pointer transition-all bg-card-2 border border-subtle',
        HOVER[cat],
      )}
    >
      <div className={cn('w-9 h-9 rounded-md flex items-center justify-center shrink-0', categoryTint14[cat], categoryText[cat])}>
        <CategoryIcon category={cat} size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold mb-[3px]">{meta.label}</div>
        <div className="text-[11.5px] text-muted leading-[1.45]">{meta.desc}</div>
      </div>
    </button>
  );
}
