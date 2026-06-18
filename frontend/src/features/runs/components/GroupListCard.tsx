import type { TestRunGroupListItemDto } from '../../../api/models';
import { FOCUS_RING } from '../../../lib/constants';
import { fmtRelative } from '../../../lib/format';
import { agentColor, modelColor, tint } from '../../../lib/colors';
import { TrashIcon, TargetIcon } from '../../../components/icons';
import { Pill } from '../../../components/ui/Pill';
import { IconButton } from '../../../components/ui/Button';
import { RowButton } from '../../../components/ui/RowButton';
import { passRateColor, passRatePercent } from '../results';

/** Card in the left-hand run-group list. Identical layout for single- and multi-model groups. */
export function GroupListCard({ group, isSelected, onSelect, onDelete }: {
  group: TestRunGroupListItemDto;
  isSelected: boolean;
  onSelect: () => void;
  /** Omit to render the card read-only (no delete affordance) — e.g. a suite's run history. */
  onDelete?: () => void;
}) {
  const c = agentColor(group.agentId);
  const runCount = group.runs.length;

  return (
    // Wrapper is a positioning + hover context so the delete control is a real
    // sibling button, not nested inside the card button (invalid HTML / a11y).
    <div className="group/card relative" data-testid={`group-list-card-${group.id}`}>
      <RowButton
        onClick={onSelect}
        aria-pressed={isSelected}
        data-testid={`group-list-card-btn-${group.id}`}
        className={`relative rounded-lg bg-card overflow-hidden pl-[17px] pr-3.5 py-3 shadow-[var(--shadow-card)] transition-[box-shadow] duration-[var(--motion-base)] ${FOCUS_RING}`}
        style={isSelected ? { boxShadow: `0 0 0 1.5px ${tint(c, 45)}, var(--shadow-card)` } : undefined}
      >
        <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg" style={{ background: c }} />

        <div className="truncate text-title font-semibold mb-2 pr-6">{group.suiteName}</div>

        <div className="flex items-center gap-1.5 mb-2.5 min-w-0">
          <Pill label={group.agentName} color={c} />
          {group.isSystemRun && (
            <span className="mono px-1.5 py-px rounded-sm text-[9.5px] font-semibold bg-accent-subtle text-accent shrink-0">A/B</span>
          )}
          {runCount > 1 && (
            <span className="mono px-1.5 py-px rounded-sm text-[9.5px] font-semibold bg-white/[0.06] text-muted shrink-0">{runCount} models</span>
          )}
          <span className="text-caption text-muted ml-auto shrink-0">{fmtRelative(group.createdAt)}</span>
        </div>

        <ModelStack runs={group.runs} />
      </RowButton>

      {onDelete && (
        <IconButton
          danger
          onClick={onDelete}
          className={`absolute top-2.5 right-2.5 opacity-0 transition-opacity duration-[var(--motion-fast)] group-hover/card:opacity-100 focus-visible:opacity-100 ${FOCUS_RING}`}
          aria-label="Delete run group"
        >
          <TrashIcon size={13} />
        </IconButton>
      )}
    </div>
  );
}

/** Per-model pass-rate stack — one row per model, used for both single- and multi-model cards. */
function ModelStack({ runs }: { runs: TestRunGroupListItemDto['runs'] }) {
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
