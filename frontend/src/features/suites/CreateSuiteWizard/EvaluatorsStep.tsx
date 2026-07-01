import { Trans, useLingui } from '@lingui/react/macro';
import type { EvaluatorDetailDto } from '../../../api/models';
import { cn } from '../../../lib/cn';
import { EVALUATOR_KIND_COLOR } from '../../../lib/colors';
import { ColoredBadge } from '../../../components/ui/ColoredBadge';
import { EmptyState } from '../../../components/ui/EmptyState';
import { RowButton } from '../../../components/ui/RowButton';

interface Props {
  evaluators: EvaluatorDetailDto[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}

export function EvaluatorsStep({ evaluators, selectedIds, onToggle }: Props) {
  const { t } = useLingui();
  if (evaluators.length === 0) {
    return (
      <div data-testid="wizard-step-evaluators" className="max-w-[640px] mx-auto">
        <EmptyState
          title={t`No evaluators yet`}
          description={t`You can create the suite without evaluators and attach them later.`}
        />
      </div>
    );
  }

  return (
    <div data-testid="wizard-step-evaluators" className="max-w-[640px] mx-auto flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-body text-muted m-0"><Trans>Attach evaluators (optional). They'll score every test run.</Trans></p>
        <span className="text-body-sm text-muted">
          <Trans>{selectedIds.size} of {evaluators.length} attached</Trans>
        </span>
      </div>
      <div className="flex flex-col gap-1.5 max-h-[420px] overflow-y-auto pr-1">
        {evaluators.map(e => {
          const c = EVALUATOR_KIND_COLOR[e.kind];
          const selected = selectedIds.has(e.id);
          return (
            <RowButton
              key={e.id}
              aria-pressed={selected}
              onClick={() => onToggle(e.id)}
              className={cn(
                'flex items-center gap-3 rounded-md cursor-pointer transition-colors duration-150 px-3 py-2.5 border border-l-[3px]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent-primary)_60%,transparent)]',
                selected ? 'bg-accent-subtle border-accent border-l-accent' : 'bg-card border-border border-l-transparent',
              )}
            >
              <ColoredBadge color={c} label={e.kind} />
              <span className="text-title font-medium flex-1 min-w-0 truncate">{e.name}</span>
            </RowButton>
          );
        })}
      </div>
    </div>
  );
}
