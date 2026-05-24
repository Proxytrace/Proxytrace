import { type EvaluatorKind } from '../../api/models';
import { type RangeKey } from '../../lib/time-range';
import { EmptyState } from '../../components/ui/EmptyState';
import { useEvaluatorOverview } from './hooks/useEvaluatorQueries';
import { StatsBlockBody } from './components/StatsBlockBody';

interface Props {
  evaluatorId: string;
  kind: EvaluatorKind;
  range: RangeKey;
  color: string;
}

/** Standalone stats block for an evaluator; handles its own loading/error states. */
export function EvaluatorStatsBlock({ evaluatorId, kind, range, color }: Props) {
  const { data, isLoading, isError } = useEvaluatorOverview(evaluatorId, range);

  if (isLoading && !data) {
    return <StatsBlockShell color={color}><div className="p-6 text-center text-muted text-[12px]">Loading statistics…</div></StatsBlockShell>;
  }
  if (isError || !data) {
    return (
      <StatsBlockShell color={color}>
        <EmptyState title="Statistics unavailable" description="The statistics service is not yet wired for evaluators." />
      </StatsBlockShell>
    );
  }
  return <StatsBlockBody data={data} kind={kind} color={color} />;
}

/** Card wrapper used only for the loading/error states; top bar tinted by the runtime `color`. */
function StatsBlockShell({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <section
      className="bg-card rounded-lg shadow-[var(--shadow-card)] px-[18px] py-4 border-t-2"
      style={{ borderTopColor: `color-mix(in srgb, ${color} 22%, transparent)` }}
    >
      {children}
    </section>
  );
}
