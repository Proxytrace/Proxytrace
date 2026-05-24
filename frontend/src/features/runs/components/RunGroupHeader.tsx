import type { TestRunGroupDto } from '../../../api/models';
import { agentColor, tint } from '../../../lib/colors';
import { fmtDuration, fmtRelative } from '../../../lib/format';
import { TrashIcon } from '../../../components/icons';
import { Pill } from '../../../components/ui/Pill';
import { Button } from '../../../components/ui/Button';
import { passRateColor, passRatePercent, avgLatency, isActive, runStatusColor } from '../results';

/**
 * Header for a run group. For a single-model group it folds the run's headline
 * metrics (pass rate, cases, duration/progress, avg latency) inline so no separate
 * KPI band is needed; for a multi-model group it shows the run count instead — the
 * per-model numbers live in the comparison matrix below.
 */
export function RunGroupHeader({ group, onDelete, onCancel, cancelPending }: {
  group: TestRunGroupDto;
  onDelete: () => void;
  onCancel: () => void;
  cancelPending: boolean;
}) {
  const c = agentColor(group.agentId);
  const sc = runStatusColor(group.status);
  const active = group.runs.some(r => isActive(r.status));
  const singleRun = group.runs.length === 1 ? group.runs[0] : null;

  return (
    <div
      className="relative overflow-hidden rounded-lg bg-card shadow-[var(--shadow-card)] px-[18px] py-3 flex items-center gap-3 flex-wrap"
    >
      <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg" style={{ background: c }} />

      <div className="flex flex-col gap-[3px] min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-h1 font-bold tracking-[-0.01em] m-0 truncate">{group.suiteName}</h2>
          <Pill label={group.agentName} color={c} />
          <span className="px-[7px] py-[2px] rounded-full text-caption font-semibold shrink-0" style={{ background: tint(sc, 18), color: sc }}>{group.status}</span>
          {active && (
            <span className="inline-flex items-center gap-1.5 text-caption text-muted shrink-0">
              <span className="pulse-dot w-[5px] h-[5px] rounded-full bg-accent inline-block" />
              live
            </span>
          )}
        </div>

        {singleRun
          ? <SingleRunStats run={singleRun} createdAt={group.createdAt} />
          : (
            <div className="flex items-center gap-2 text-body-sm text-muted">
              <span className="mono">{group.id.slice(0, 8)}</span>
              <span>·</span>
              <span>{fmtRelative(group.createdAt)}</span>
              <span>·</span>
              <span>{group.runs.length} models</span>
            </div>
          )
        }
      </div>

      <div className="flex gap-2 shrink-0">
        {active && (
          <Button variant="secondary" size="sm" onClick={onCancel} loading={cancelPending}>Cancel</Button>
        )}
        <button onClick={onDelete} className="btn-icon btn-icon-danger" aria-label="Delete run group" title="Delete run group"><TrashIcon size={14} /></button>
      </div>
    </div>
  );
}

/** Inline metric line for a single-model group — replaces the standalone KPI band. */
function SingleRunStats({ run, createdAt }: { run: TestRunGroupDto['runs'][number]; createdAt: string }) {
  const active = isActive(run.status);
  const hasResults = run.results.length > 0;
  const pr = passRatePercent(run.passedCases, run.totalCases);
  const avg = avgLatency(run);

  return (
    <div className="flex items-center gap-2 text-body-sm text-muted flex-wrap">
      {hasResults && (
        <>
          <span className="mono font-semibold" style={{ color: passRateColor(pr) }}>{pr}% pass</span>
          <span>·</span>
        </>
      )}
      <span className="mono text-secondary">{run.passedCases}/{run.totalCases}</span>
      <span>·</span>
      {active
        ? <span className="mono">{run.results.length}/{run.totalCases} done</span>
        : <span className="mono">{fmtDuration(run.durationMs ?? 0)} total</span>
      }
      {avg !== null && (
        <>
          <span>·</span>
          <span className="mono">~{fmtDuration(avg)} avg</span>
        </>
      )}
      <span className="text-muted/70">·</span>
      <span>{fmtRelative(createdAt)}</span>
    </div>
  );
}
