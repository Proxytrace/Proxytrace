import { cn } from '../../../lib/cn';
import { type RangeKey } from '../../../lib/time-range';
import { EvaluatorKind, type EvaluatorDetailDto } from '../../../api/models';
import { KIND_CATEGORY } from '../evaluatorMeta';
import { useEvaluatorDetail } from '../hooks/useEvaluatorQueries';
import { WorkspaceHeader } from './WorkspaceHeader';
import { PerformancePanel } from './PerformancePanel';
import { DefinitionPanel } from './DefinitionPanel';
import { ScoreDistributionPanel } from './ScoreDistributionPanel';
import { CostPanel } from './CostPanel';
import { AttachedPanel, type AttachedSuite } from './AttachedPanel';
import { RecentEvaluationsTable } from './RecentEvaluationsTable';

interface Props {
  evaluator: EvaluatorDetailDto;
  attachedSuites: AttachedSuite[];
  range: RangeKey;
  onRangeChange: (r: RangeKey) => void;
  onEdit: () => void;
  onDelete: () => void;
  onTestBench: (id: string) => void;
}

/** Full detail view for one evaluator — stacks the header and all stat panels. */
export function EvaluatorDetail({ evaluator: e, attachedSuites, range, onRangeChange, onEdit, onDelete, onTestBench }: Props) {
  const cat = KIND_CATEGORY[e.kind];
  const showCost = e.kind === EvaluatorKind.Agentic;
  const agentNames = Array.from(new Set(attachedSuites.map(s => s.agentName)));

  const { data: detail, isLoading } = useEvaluatorDetail(e.id, range);
  const overview = detail?.overview ?? null;

  return (
    <div className="fade-up flex flex-col gap-3.5">
      <WorkspaceHeader evaluator={e} onEdit={onEdit} onDelete={onDelete} onTestBench={() => onTestBench(e.id)} />

      <PerformancePanel evaluator={e} overview={overview} range={range} onRangeChange={onRangeChange} />

      <DefinitionPanel evaluator={e} onEdit={onEdit} />

      <div className={cn('grid gap-3.5', showCost ? 'grid-cols-[1.4fr_1fr]' : 'grid-cols-1')}>
        <ScoreDistributionPanel
          buckets={overview?.scoreDistribution ?? []}
          category={cat}
          totalRuns={overview?.summary.totalEvaluations ?? 0}
          range={range}
        />
        {showCost && (
          <CostPanel overview={overview} category={cat} modelName={e.endpointName ?? null} range={range} />
        )}
      </div>

      <AttachedPanel suites={attachedSuites} agentNames={agentNames} />

      <RecentEvaluationsTable rows={detail?.recentEvaluations ?? []} isLoading={isLoading} />
    </div>
  );
}
