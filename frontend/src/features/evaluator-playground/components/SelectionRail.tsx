import type { EvaluatorListItemDto } from '../../../api/models';
import { TargetIcon } from '../../../components/icons';
import { RailHeader, RAIL_CARD_CLS } from '../../../components/ui/ListRail';
import { RailSection } from './RailSection';
import { EvaluatorRailList } from './EvaluatorRailList';
import { PastEvaluationList } from './PastEvaluationList';
import type { PastEvaluation } from '../hooks/useRecentEvaluations';

interface Props {
  evaluators: EvaluatorListItemDto[];
  selectedEvaluatorId: string;
  onSelectEvaluator: (id: string) => void;
  recent: { items: PastEvaluation[]; isLoading: boolean };
  selectedCaseId: string | null;
  onSelectCase: (testCaseId: string) => void;
}

/** Left rail: the spine of the playground — pick an evaluator, then a past evaluation. */
export function SelectionRail({
  evaluators, selectedEvaluatorId, onSelectEvaluator,
  recent, selectedCaseId, onSelectCase,
}: Props) {
  const selectedName = evaluators.find(e => e.id === selectedEvaluatorId)?.name ?? '';
  return (
    <aside className={RAIL_CARD_CLS}>
      <RailHeader
        leading={
          <span className="w-8 h-8 rounded-md bg-accent-subtle text-accent inline-flex items-center justify-center shrink-0">
            <TargetIcon size={16} />
          </span>
        }
        title="Evaluator playground"
        subtitle="Pick a judge, then a case"
      />

      <div className="flex-1 min-h-0 p-3 flex flex-col gap-3">
        <RailSection title="Evaluator">
          <EvaluatorRailList
            evaluators={evaluators}
            selectedId={selectedEvaluatorId}
            onSelect={onSelectEvaluator}
          />
        </RailSection>

        <RailSection title="Past evaluation">
          <PastEvaluationList
            evaluatorId={selectedEvaluatorId}
            evaluatorName={selectedName}
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
