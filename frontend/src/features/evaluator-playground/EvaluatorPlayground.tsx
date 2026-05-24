import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import useCurrentProject from '../../hooks/useCurrentProject';
import { evaluatorsApi } from '../../api/evaluators';
import { QUERY_KEYS } from '../../api/query-keys';
import { EvaluatorKind, type EvaluatorDetailDto } from '../../api/models';
import { EvaluatorTestBench } from '../evaluators/EvaluatorTestBench';
import { EmptyState } from '../../components/ui/EmptyState';
import { ScaleIcon, BeakerIcon } from '../../components/icons';

const KIND_LABEL: Record<EvaluatorKind, string> = {
  [EvaluatorKind.Agentic]: 'Agentic',
  [EvaluatorKind.ExactMatch]: 'Exact match',
  [EvaluatorKind.NumericMatch]: 'Numeric',
  [EvaluatorKind.JsonSchemaMatch]: 'JSON schema',
};

export default function EvaluatorPlayground() {
  const { currentProject } = useCurrentProject();
  const projectId = currentProject?.id ?? null;
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('id');

  const { data: evaluators = [], isLoading } = useQuery({
    queryKey: QUERY_KEYS.evaluators(projectId ?? undefined),
    queryFn: () => evaluatorsApi.list(projectId ? { projectId } : undefined),
    enabled: projectId != null,
  });

  const sorted = useMemo(
    () => [...evaluators].sort((a, b) => a.name.localeCompare(b.name)),
    [evaluators],
  );

  useEffect(() => {
    if (!sorted.length) return;
    if (selectedId && sorted.some(e => e.id === selectedId)) return;
    const next = new URLSearchParams(searchParams);
    next.set('id', sorted[0].id);
    setSearchParams(next, { replace: true });
  }, [sorted, selectedId, searchParams, setSearchParams]);

  const selected = sorted.find(e => e.id === selectedId) ?? null;

  function selectEvaluator(id: string) {
    const next = new URLSearchParams(searchParams);
    next.set('id', id);
    setSearchParams(next, { replace: false });
  }

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      <PageHeader
        evaluator={selected}
        evaluators={sorted}
        onSelect={selectEvaluator}
        loading={isLoading}
      />

      {!projectId ? (
        <EmptyState title="No project" description="Pick a project to use the evaluator playground." />
      ) : isLoading ? (
        <div className="text-[12.5px] text-muted py-10 text-center">Loading evaluators…</div>
      ) : sorted.length === 0 ? (
        <EmptyState
          title="No evaluators yet"
          description="Create an evaluator first, then come back here to probe it against past test results."
        />
      ) : selected ? (
        <EvaluatorTestBench
          key={selected.id}
          evaluatorId={selected.id}
          projectId={projectId}
        />
      ) : (
        <EmptyState title="Pick an evaluator" description="Select an evaluator above to start." />
      )}
    </div>
  );
}

function PageHeader({ evaluator, evaluators, onSelect, loading }: {
  evaluator: EvaluatorDetailDto | null;
  evaluators: EvaluatorDetailDto[];
  onSelect: (id: string) => void;
  loading: boolean;
}) {
  return (
    <header
      className="flex items-center gap-4 p-4 rounded-[var(--radius-lg)] bg-card shadow-[var(--shadow-card)]"
    >
      <span
        className="w-10 h-10 rounded-[var(--radius-md)] inline-flex items-center justify-center shrink-0 text-accent bg-[color-mix(in_srgb,var(--accent-primary)_14%,transparent)]"
      >
        <BeakerIcon size={18} />
      </span>
      <div className="flex-1 min-w-0">
        <h1 className="text-[17px] font-bold tracking-[-0.01em] m-0">Evaluator Playground</h1>
        <p className="text-[11.5px] text-muted mt-0.5">
          Probe an evaluator against past test results. Edit the actual response to inspect behavior.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <ScaleIcon size={13} />
        <label
          htmlFor="evaluator-playground-select"
          className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted"
        >
          Evaluator
        </label>
        <select
          id="evaluator-playground-select"
          value={evaluator?.id ?? ''}
          onChange={e => onSelect(e.target.value)}
          disabled={loading || evaluators.length === 0}
          className="px-2.5 py-1.5 rounded-md bg-card-2 border border-hairline text-[12px] text-primary outline-none focus:ring-1 focus:ring-accent cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 min-w-[200px]"
        >
          {evaluators.length === 0 && <option value="">No evaluators</option>}
          {evaluators.map(e => (
            <option key={e.id} value={e.id}>
              {e.name} · {KIND_LABEL[e.kind]}
            </option>
          ))}
        </select>
      </div>
    </header>
  );
}
