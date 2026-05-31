import type { EvaluatorDetailDto } from '../../../api/models';
import { EVALUATOR_KIND_COLOR } from '../../../lib/colors';
import { ColoredBadge } from '../../../components/ui/ColoredBadge';
import { EmptyState } from '../../../components/ui/EmptyState';

interface Props {
  evaluators: EvaluatorDetailDto[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}

export function EvaluatorsStep({ evaluators, selectedIds, onToggle }: Props) {
  if (evaluators.length === 0) {
    return (
      <div data-testid="wizard-step-evaluators" className="max-w-[640px] mx-auto">
        <EmptyState
          title="No evaluators yet"
          description="You can create the suite without evaluators and attach them later."
        />
      </div>
    );
  }

  return (
    <div data-testid="wizard-step-evaluators" className="max-w-[640px] mx-auto flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] text-muted m-0">Attach evaluators (optional). They'll score every test run.</p>
        <span className="text-[11.5px] text-muted">
          {selectedIds.size} of {evaluators.length} attached
        </span>
      </div>
      <div className="flex flex-col gap-1.5 max-h-[420px] overflow-y-auto pr-1">
        {evaluators.map(e => {
          const c = EVALUATOR_KIND_COLOR[e.kind];
          const selected = selectedIds.has(e.id);
          return (
            <div
              key={e.id}
              onClick={() => onToggle(e.id)}
              className="flex items-center gap-3 rounded-[9px] cursor-pointer transition-colors duration-150"
              style={{
                padding: '10px 12px',
                background: selected ? 'var(--accent-subtle)' : 'var(--bg-card)',
                border: `1px solid ${selected ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                borderLeft: `3px solid ${selected ? 'var(--accent-primary)' : 'transparent'}`,
              }}
            >
              <ColoredBadge color={c} label={e.kind} />
              <span className="text-[13px] font-medium flex-1 min-w-0 truncate">{e.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
