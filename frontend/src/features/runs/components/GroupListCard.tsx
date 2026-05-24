import type { TestRunGroupDto } from '../../../api/models';
import { FOCUS_RING } from '../../../lib/constants';
import { fmtRelative } from '../../../lib/format';
import { agentColor, modelColor, tint } from '../../../lib/colors';
import { TrashIcon, TargetIcon } from '../../../components/icons';
import { Pill } from '../../../components/ui/Pill';
import { passRateColor, passRatePercent } from '../results';

/** Card in the left-hand run-group list. Identical layout for single- and multi-model groups. */
export function GroupListCard({ group, isSelected, onSelect, onDelete }: {
  group: TestRunGroupDto;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const c = agentColor(group.agentId);
  const runCount = group.runs.length;

  return (
    <button
      onClick={onSelect}
      aria-pressed={isSelected}
      className={`relative w-full text-left rounded-lg bg-card overflow-hidden pl-[17px] pr-3.5 py-3 cursor-pointer shadow-[var(--shadow-card)] transition-[box-shadow] duration-[var(--motion-base)] ${FOCUS_RING}`}
      style={isSelected ? { boxShadow: `0 0 0 1.5px ${tint(c, 45)}, var(--shadow-card)` } : undefined}
    >
      <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg" style={{ background: c }} />

      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="min-w-0">
          {runCount > 1 && (
            <span className="mono px-1.5 py-px rounded-sm text-[9.5px] font-semibold bg-white/[0.06] text-muted">{runCount} models</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-caption text-muted">{fmtRelative(group.createdAt)}</span>
          <button onClick={e => { e.stopPropagation(); onDelete(); }} className="btn-icon btn-icon-danger" aria-label="Delete run group"><TrashIcon size={13} /></button>
        </div>
      </div>

      <div className="truncate text-title font-semibold mb-1.5">{group.suiteName}</div>
      <div className="mb-2">
        <Pill label={group.agentName} color={c} />
      </div>

      <ModelStack runs={group.runs} />
    </button>
  );
}

/** Per-model pass-rate stack — one row per model, used for both single- and multi-model cards. */
function ModelStack({ runs }: { runs: TestRunGroupDto['runs'] }) {
  const rates = runs.map(r => passRatePercent(r.passedCases, r.passedCases + r.failedCases));
  const best = Math.max(...rates.map(r => r ?? -1));
  const showWinner = runs.length > 1;

  return (
    <div className="flex flex-col gap-1">
      {runs.map((run, i) => {
        const pr = rates[i];
        const prc = passRateColor(pr);
        const mc = modelColor(run.endpointName);
        const winner = showWinner && pr !== null && pr === best;
        return (
          <div key={run.id} className="grid grid-cols-[84px_1fr_auto] gap-2 items-center">
            <span className="mono text-caption flex items-center gap-1 min-w-0" style={{ color: mc }}>
              <span className="w-1.5 h-1.5 rounded-sm shrink-0" style={{ background: mc }} />
              <span className="truncate">{run.endpointName}</span>
            </span>
            <span className="h-[5px] rounded-full bg-white/[0.06] overflow-hidden">
              <span className="block h-full rounded-full" style={{ width: `${pr ?? 0}%`, background: prc }} />
            </span>
            <span className="mono text-caption font-bold flex items-center gap-1 justify-end min-w-[34px]" style={{ color: prc }}>
              {pr === null ? '—' : `${pr}%`}
              {winner && <TargetIcon size={9} className="text-accent" />}
            </span>
          </div>
        );
      })}
    </div>
  );
}
