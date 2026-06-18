import type { TestRunGroupListItemDto } from '../../../api/models';
import { fmtRelative } from '../../../lib/format';
import { FOCUS_RING } from '../../../lib/constants';
import { RowButton } from '../../../components/ui/RowButton';
import { passRateColor, passRatePercent } from '../results';

/** Aggregates a group's per-model pass counts into a single group-level pass rate (0..100 | null). */
function groupPassRate(group: TestRunGroupListItemDto): number | null {
  const passed = group.runs.reduce((s, r) => s + r.passedCases, 0);
  const total = group.runs.reduce((s, r) => s + r.passedCases + r.failedCases, 0);
  return passRatePercent(passed, total);
}

/**
 * A horizontal strip of a schedule's most recent runs. Each chip shows a status dot coloured by its
 * pass rate (reusing the runs list's {@link passRateColor} thresholds), the percent, and a relative
 * time. Clicking deep-links into the run-group detail via the supplied handler.
 */
export function RecentRunStrip({ runs, onSelect }: {
  runs: TestRunGroupListItemDto[];
  onSelect: (groupId: string) => void;
}) {
  if (runs.length === 0) {
    return <div className="text-caption text-muted">No runs yet</div>;
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {runs.map(group => {
        const pr = groupPassRate(group);
        const prc = passRateColor(pr);
        return (
          <RowButton
            key={group.id}
            onClick={() => onSelect(group.id)}
            data-testid={`schedule-recent-run-${group.id}`}
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-sm bg-card-2 ${FOCUS_RING}`}
          >
            <span aria-hidden className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: prc }} />
            <span className="mono text-caption font-bold" style={{ color: prc }}>
              {pr === null ? '—' : `${pr}%`}
            </span>
            <span className="text-caption text-muted">{fmtRelative(group.createdAt)}</span>
          </RowButton>
        );
      })}
    </div>
  );
}
