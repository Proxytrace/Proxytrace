import type { TestSuiteListItemDto } from '../../../api/models';
import { FOCUS_RING } from '../../../lib/constants';
import { fmtRelative } from '../../../lib/format';
import { agentColor, tint } from '../../../lib/colors';
import { TrashIcon } from '../../../components/icons';
import { Pill } from '../../../components/ui/Pill';
import { IconButton } from '../../../components/ui/Button';
import { RowButton } from '../../../components/ui/RowButton';
import { passRateColor } from '../suitesMeta';

interface Props {
  suite: TestSuiteListItemDto;
  selected: boolean;
  highlight?: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

/** Card in the left-hand suite list — mirrors the Runs `GroupListCard` shape: a `RowButton` card with
 * a left accent bar and select ring, plus a hover-revealed delete control as a real sibling button. */
export function SuiteListCard({ suite, selected, highlight = false, onSelect, onDelete }: Props) {
  const c = agentColor(suite.agentId);
  const prc = passRateColor(suite.passRate);

  return (
    <div className="group/card relative" data-testid={`suite-card-${suite.id}`}>
      <RowButton
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={`Select suite ${suite.name}`}
        data-testid={`suite-select-${suite.id}`}
        className={`relative rounded-lg bg-card overflow-hidden pl-[17px] pr-3.5 py-3 shadow-[var(--shadow-card)] transition-[box-shadow] duration-[var(--motion-base)] ${FOCUS_RING}`}
        style={selected || highlight ? { boxShadow: `0 0 0 1.5px ${tint(c, 45)}, var(--shadow-card)` } : undefined}
      >
        <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg" style={{ background: c }} />

        <div className="truncate text-title font-semibold mb-2 pr-6" data-testid={`suite-name-${suite.id}`}>{suite.name}</div>

        <div className="flex items-center gap-1.5 mb-2 min-w-0">
          <Pill label={suite.agentName} color={c} />
          <span className="text-caption text-muted ml-auto shrink-0">
            {suite.lastRunAt ? fmtRelative(suite.lastRunAt) : 'Never run'}
          </span>
        </div>

        <div className="flex items-center gap-3 text-caption text-muted">
          <span data-testid={`suite-case-count-${suite.id}`}>
            {suite.testCaseCount} case{suite.testCaseCount !== 1 ? 's' : ''}
          </span>
          <span className="text-border">·</span>
          <span className="mono font-bold" style={{ color: prc }}>
            {suite.passRate !== null ? `${Math.round(suite.passRate)}%` : '—'}
          </span>
        </div>

        <span data-testid={`suite-evaluator-count-${suite.id}`} className="sr-only">{suite.evaluators.length}</span>
      </RowButton>

      <IconButton
        danger
        onClick={onDelete}
        data-testid={`suite-delete-btn-${suite.id}`}
        className={`absolute top-2.5 right-2.5 opacity-0 transition-opacity duration-[var(--motion-fast)] group-hover/card:opacity-100 focus-visible:opacity-100 ${FOCUS_RING}`}
        aria-label="Delete suite"
      >
        <TrashIcon size={13} />
      </IconButton>
    </div>
  );
}
