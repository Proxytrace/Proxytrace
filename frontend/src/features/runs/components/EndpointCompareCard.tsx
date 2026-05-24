import type { TestRunDto } from '../../../api/models';
import { FOCUS_RING } from '../../../lib/constants';
import { fmtDuration } from '../../../lib/format';
import { modelColor } from '../../../lib/colors';
import { passRateColor, isActive, avgLatency } from '../results';
import { Minimap } from './Minimap';

/** Per-endpoint summary card in the multi-run comparison strip. */
export function EndpointCompareCard({
  run, isSelected, onSelect, activeCaseIds,
}: {
  run: TestRunDto;
  isSelected: boolean;
  onSelect: () => void;
  activeCaseIds?: Set<string>;
}) {
  const mc = modelColor(run.endpointName);
  const passRate = run.totalCases > 0 ? Math.round((run.passedCases / run.totalCases) * 100) : null;
  const pc = passRateColor(passRate);
  const active = isActive(run.status);
  const avg = avgLatency(run);

  return (
    <button
      onClick={onSelect}
      aria-pressed={isSelected}
      className={`flex-[1_1_220px] min-w-[220px] text-left flex flex-col gap-2.5 rounded-lg bg-card px-3.5 py-3 overflow-hidden cursor-pointer shadow-[var(--shadow-card)] border transition-[border-color,box-shadow] duration-[var(--motion-base)] ${FOCUS_RING}`}
      style={{
        borderColor: isSelected ? mc : 'transparent',
        boxShadow: isSelected ? `0 0 0 3px color-mix(in srgb, ${mc} 14%, transparent), var(--shadow-card)` : undefined,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: mc }} />
          <span className="mono text-body font-semibold truncate">{run.endpointName}</span>
        </div>
        {active && <span className="pulse-dot w-1.5 h-1.5 rounded-full bg-accent shrink-0" />}
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-1.5">
          <span className="mono text-h1 font-bold tracking-[-0.02em] leading-none" style={{ color: pc }}>
            {passRate !== null ? `${passRate}%` : '—'}
          </span>
          <span className="mono text-caption text-muted">{run.passedCases}/{run.totalCases}</span>
        </div>
        {avg !== null && <span className="mono text-caption text-muted">~{fmtDuration(avg)}</span>}
      </div>

      <Minimap run={run} activeCaseIds={activeCaseIds} size={10} />
    </button>
  );
}
