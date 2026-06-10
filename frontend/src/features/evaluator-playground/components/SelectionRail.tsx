import type { EvaluatorListItemDto } from '../../../api/models';
import { TargetIcon } from '../../../components/icons';
import { RailSection } from './RailSection';
import { EvaluatorRailList } from './EvaluatorRailList';
import { PastEvaluationList } from './PastEvaluationList';
import type { PastEvaluation } from '../hooks/useRecentEvaluations';

interface Props {
  evaluators: EvaluatorListItemDto[];
  selectedEvaluatorId: string;
  onSelectEvaluator: (id: string) => void;
  projectId: string;
  recent: { items: PastEvaluation[]; isLoading: boolean };
  selectedCaseId: string | null;
  onSelectCase: (testCaseId: string) => void;
}

/** Left rail: the spine of the playground — pick an evaluator, then a past evaluation. */
export function SelectionRail({
  evaluators, selectedEvaluatorId, onSelectEvaluator,
  projectId, recent, selectedCaseId, onSelectCase,
}: Props) {
  return (
    <aside className="flex flex-col rounded-lg bg-card border border-border-subtle overflow-hidden min-h-0">
      <div className="px-4 py-4 border-b border-hairline flex items-center gap-2.5 shrink-0">
        <span className="w-8 h-8 rounded-md bg-accent-subtle text-accent inline-flex items-center justify-center shrink-0">
          <TargetIcon size={16} />
        </span>
        <div className="min-w-0">
          <div className="text-h2 font-bold tracking-[-0.01em]">Evaluator Playground</div>
          <div className="text-[11px] text-muted">Pick a judge, then a case</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-5 min-h-0">
        <RailSection step="1" title="Evaluator">
          <EvaluatorRailList
            evaluators={evaluators}
            selectedId={selectedEvaluatorId}
            onSelect={onSelectEvaluator}
          />
        </RailSection>

        <RailSection step="2" title="Past evaluation">
          <PastEvaluationList
            projectId={projectId}
            items={recent.items}
            selectedCaseId={selectedCaseId}
            onSelect={onSelectCase}
            isLoading={recent.isLoading}
          />
        </RailSection>
      </div>
    </aside>
  );
}
