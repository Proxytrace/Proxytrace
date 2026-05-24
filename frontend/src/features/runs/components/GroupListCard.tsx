import type { TestRunGroupDto } from '../../../api/models';
import { TestRunStatus } from '../../../api/models';
import { FOCUS_RING } from '../../../lib/constants';
import { fmtRelative } from '../../../lib/format';
import { agentColor, tint } from '../../../lib/colors';
import { TrashIcon } from '../../../components/icons';
import { Pill } from '../../../components/ui/Pill';
import { passRateColor, passRatePercent, runStatusColor, isActive } from '../results';

/** Card in the left-hand run-group list. */
export function GroupListCard({ group, isSelected, onSelect, onDelete }: {
  group: TestRunGroupDto;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const c = agentColor(group.agentId);
  const totalCases = group.runs.reduce((s, r) => s + r.totalCases, 0);
  const passedCases = group.runs.reduce((s, r) => s + r.passedCases, 0);
  const passRate = passRatePercent(passedCases, totalCases);
  const pc = passRateColor(passRate);
  const sc = runStatusColor(group.status);
  const runCount = group.runs.length;

  return (
    <button
      onClick={onSelect}
      aria-pressed={isSelected}
      className={`relative w-full text-left rounded-lg bg-card overflow-hidden pl-[17px] pr-3.5 py-3 cursor-pointer shadow-[var(--shadow-card)] transition-[box-shadow] duration-[var(--motion-base)] ${FOCUS_RING}`}
      style={isSelected ? { boxShadow: `0 0 0 1.5px ${tint(c, 45)}, var(--shadow-card)` } : undefined}
    >
      <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg" style={{ background: c }} />
      <div className="flex items-center justify-between mb-1.5">
        {runCount > 1
          ? <span className="mono px-1.5 py-px rounded-sm text-[9.5px] font-semibold bg-white/[0.06] text-muted">{runCount} models</span>
          : <span className="text-caption text-muted">{fmtRelative(group.createdAt)}</span>
        }
        <div className="flex items-center gap-1.5">
          {runCount > 1 && <span className="text-caption text-muted">{fmtRelative(group.createdAt)}</span>}
          <button onClick={e => { e.stopPropagation(); onDelete(); }} className="btn-icon btn-icon-danger" aria-label="Delete run group"><TrashIcon size={13} /></button>
        </div>
      </div>
      <div className="truncate text-title font-semibold mb-1.5">{group.suiteName}</div>
      <div className="mb-2">
        <Pill label={group.agentName} color={c} />
      </div>
      {group.status === TestRunStatus.Completed && passRate !== null ? (
        <div className="flex items-center justify-between">
          <span className="mono text-h2 font-bold" style={{ color: pc }}>{passRate}%</span>
          <span className="text-caption text-muted">{passedCases}/{totalCases}</span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <span className={`w-[7px] h-[7px] rounded-full shrink-0 inline-block ${isActive(group.status) ? 'pulse-dot' : ''}`} style={{ background: sc }} />
          <span className="text-body-sm font-semibold" style={{ color: sc }}>{group.status}</span>
        </div>
      )}
    </button>
  );
}
