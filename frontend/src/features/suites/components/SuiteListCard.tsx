import type { TestSuiteListItemDto } from '../../../api/models';
import { agentColor } from '../../../lib/colors';
import { fmtRelative } from '../../../lib/format';
import { cn } from '../../../lib/cn';
import { FOCUS_RING } from '../../../lib/constants';
import { RowButton } from '../../../components/ui/RowButton';
import { IconButton } from '../../../components/ui/Button';
import { TrashIcon } from '../../../components/icons';
import { passRateColor } from '../suitesMeta';

interface Props {
  suite: TestSuiteListItemDto;
  selected: boolean;
  highlight?: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

export function SuiteListCard({ suite, selected, highlight = false, onSelect, onDelete }: Props) {
  const c = agentColor(suite.agentId);
  return (
    <div
      data-testid={`suite-card-${suite.id}`}
      className={cn(
        'relative rounded-lg bg-card shadow-[var(--shadow-card)] overflow-hidden transition-shadow duration-[160ms]',
        (selected || highlight) &&
          'ring-1 ring-inset ring-[color-mix(in_srgb,var(--suite-accent)_55%,transparent)]',
      )}
      style={{ ['--suite-accent' as string]: c }}
    >
      <RowButton
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={`Select suite ${suite.name}`}
        data-testid={`suite-select-${suite.id}`}
        className={cn('absolute inset-0 z-[1] rounded-lg', FOCUS_RING)}
      />
      <div className="h-[3px]" style={{ background: c }} />
      <div className="px-3 py-2.5 flex flex-col gap-1.5">
        <div className="flex items-start gap-2">
          <span className="text-title font-semibold truncate min-w-0 flex-1" data-testid={`suite-name-${suite.id}`}>
            {suite.name}
          </span>
          <IconButton
            danger
            className="relative z-[2] shrink-0"
            onClick={onDelete}
            data-testid={`suite-delete-btn-${suite.id}`}
            aria-label="Delete suite"
          >
            <TrashIcon size={12} />
          </IconButton>
        </div>
        <span
          className="self-start px-1.5 py-[1px] rounded-full text-[10px] font-semibold"
          style={{ background: `color-mix(in srgb, ${c} 14%, transparent)`, color: c }}
        >
          {suite.agentName}
        </span>
        <div className="flex items-center gap-3 text-body-sm text-muted">
          <span data-testid={`suite-case-count-${suite.id}`}>{suite.testCaseCount} cases</span>
          <span style={{ color: passRateColor(suite.passRate) }}>
            {suite.passRate !== null ? `${Math.round(suite.passRate)}%` : '—'}
          </span>
          <span className="ml-auto">{suite.lastRunAt ? fmtRelative(suite.lastRunAt) : 'Never run'}</span>
        </div>
        <span data-testid={`suite-evaluator-count-${suite.id}`} className="sr-only">{suite.evaluators.length}</span>
      </div>
    </div>
  );
}
