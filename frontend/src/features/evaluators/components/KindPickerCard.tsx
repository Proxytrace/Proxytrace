import { Link } from 'react-router-dom';
import { Trans, useLingui } from '@lingui/react/macro';
import { cn } from '../../../lib/cn';
import type { EvaluatorKind } from '../../../api/models';
import { KIND_CATEGORY, META, type TypeCategory } from '../evaluatorMeta';
import { categoryText, categoryTint14 } from '../categoryClasses';
import { CategoryIcon } from './evaluatorIcons';
import { LockIcon } from '../../../components/icons';
import { RowButton } from '../../../components/ui/RowButton';

/** Per-category hover recipe for the kind picker cards (wash + border tint). */
const HOVER: Record<TypeCategory, string> = {
  llm: cn('hover:bg-[color-mix(in_srgb,var(--accent-primary)_10%,var(--bg-card-2))] hover:border-[color-mix(in_srgb,var(--accent-primary)_44%,transparent)]'),
  rule: cn('hover:bg-[color-mix(in_srgb,var(--teal)_10%,var(--bg-card-2))] hover:border-[color-mix(in_srgb,var(--teal)_44%,transparent)]'),
  numeric: cn('hover:bg-[color-mix(in_srgb,var(--teal)_10%,var(--bg-card-2))] hover:border-[color-mix(in_srgb,var(--teal)_44%,transparent)]'),
};

/** A selectable evaluator-kind card in the create modal's first step. */
export function KindPickerCard({ kind, onPick, locked = false }: {
  kind: EvaluatorKind;
  onPick: (k: EvaluatorKind) => void;
  locked?: boolean;
}) {
  const { i18n } = useLingui();
  const cat = KIND_CATEGORY[kind];
  const meta = META[kind];

  const inner = (
    <>
      <div className={cn('w-9 h-9 rounded-md flex items-center justify-center shrink-0', categoryTint14[cat], categoryText[cat])}>
        <CategoryIcon category={cat} size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold mb-[3px] flex items-center gap-1.5">
          {i18n._(meta.label)}
          {locked && <LockIcon size={12} className="text-muted" />}
        </div>
        <div className="text-[11.5px] text-muted leading-[1.45]">
          {locked ? <Trans>Requires the Enterprise tier. Upgrade to enable LLM-judge evaluators.</Trans> : i18n._(meta.desc)}
        </div>
      </div>
    </>
  );

  if (locked) {
    return (
      <Link
        to="/upgrade"
        data-testid={`evaluator-kind-locked-${kind}`}
        className={cn(
          'text-left p-3.5 rounded-lg flex gap-3 cursor-pointer transition-all bg-card-2 border border-transparent opacity-60 hover:opacity-100',
        )}
      >
        {inner}
      </Link>
    );
  }

  return (
    <RowButton
      onClick={() => onPick(kind)}
      data-testid={`evaluator-kind-${kind}`}
      className={cn(
        'p-3.5 rounded-lg flex gap-3 transition-all bg-card-2 border border-transparent',
        HOVER[cat],
      )}
    >
      {inner}
    </RowButton>
  );
}
