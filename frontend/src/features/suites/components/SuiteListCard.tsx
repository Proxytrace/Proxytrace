import { Trans, Plural, useLingui } from '@lingui/react/macro';
import type { TestSuiteListItemDto } from '../../../api/models';
import { FOCUS_RING } from '../../../lib/constants';
import { fmtRelative } from '../../../lib/format';
import { agentColor } from '../../../lib/colors';
import { cn } from '../../../lib/cn';
import { selectionRowStyle, selectionBarStyle, SELECTION_ROW_INACTIVE } from '../../../lib/selectionRow';
import { TrashIcon } from '../../../components/icons';
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

/** Card in the left-hand suite list — mirrors the Agents list row for a compact, scannable look: an
 * avatar-led `RowButton` with the suite name + its agent on the subline, and a one-line meta row
 * (cases · pass rate · last run). Active state uses the agent-colored flat wash + inset ring +
 * left bar; the delete control is a hover-revealed sibling button (valid HTML, not nested). */
export function SuiteListCard({ suite, selected, highlight = false, onSelect, onDelete }: Props) {
  const { t } = useLingui();
  const c = agentColor(suite.agentId);
  const prc = passRateColor(suite.passRate);
  const active = selected || highlight;
  const initial = suite.name[0]?.toUpperCase() ?? '?';

  return (
    <div className="group/card relative" data-testid={`suite-card-${suite.id}`}>
      <RowButton
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={t`Select suite ${suite.name}`}
        data-testid={`suite-select-${suite.id}`}
        className={cn('rounded-lg relative overflow-hidden transition-[box-shadow,background-color] duration-150 px-3 py-2.5 pl-3.5', FOCUS_RING, active ? '' : SELECTION_ROW_INACTIVE)}
        style={active ? selectionRowStyle(c) : undefined}
      >
        {active && <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px]" style={selectionBarStyle(c)} />}

        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="flex items-center justify-center shrink-0 w-[30px] h-[30px] rounded-md"
            style={{
              background: `color-mix(in srgb, ${c} 12%, transparent)`,
              border: `1px solid color-mix(in srgb, ${c} 30%, transparent)`,
            }}
          >
            <span className="text-title font-bold font-mono" style={{ color: c }}>{initial}</span>
          </div>
          <div className="flex-1 min-w-0 pr-6">
            <div className="text-body font-semibold text-primary truncate" data-testid={`suite-name-${suite.id}`}>{suite.name}</div>
            <div className="text-caption text-muted truncate font-mono">{suite.agentName}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-1.5 text-caption text-muted pl-10">
          <span>
            <span data-testid={`suite-case-count-${suite.id}`}>{suite.testCaseCount}</span>{' '}
            <Plural value={suite.testCaseCount} one="case" other="cases" />
          </span>
          <span className="text-border">·</span>
          <span className="mono font-bold" style={{ color: prc }}>
            {suite.passRate !== null ? `${Math.round(suite.passRate)}%` : '—'}
          </span>
          <span className="ml-auto shrink-0 font-mono">{suite.lastRunAt ? fmtRelative(suite.lastRunAt) : <Trans>never</Trans>}</span>
        </div>

        <span data-testid={`suite-evaluator-count-${suite.id}`} className="sr-only">{suite.evaluators.length}</span>
      </RowButton>

      <IconButton
        danger
        onClick={onDelete}
        data-testid={`suite-delete-btn-${suite.id}`}
        className={`absolute top-2.5 right-2.5 opacity-0 transition-opacity duration-[var(--motion-fast)] group-hover/card:opacity-100 focus-visible:opacity-100 ${FOCUS_RING}`}
        aria-label={t`Delete suite`}
      >
        <TrashIcon size={13} />
      </IconButton>
    </div>
  );
}
