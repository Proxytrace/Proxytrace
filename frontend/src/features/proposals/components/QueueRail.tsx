import { useLingui } from '@lingui/react/macro';
import { ChevronRightIcon } from '../../../components/icons';
import { ListRail } from '../../../components/ui/ListRail';
import { FilterDropdown, type FilterDropdownOption } from '../../../components/ui/FilterDropdown';
import { RowButton } from '../../../components/ui/RowButton';
import type { TheoryDto } from '../../../api/models';
import { cn } from '../../../lib/cn';
import { TONE_BG } from '../shared';
import type { ProposalById, QueueGroupKey, QueueGroupMeta } from '../theoryQueue';
import { proposalFor, QUEUE_GROUPS } from '../theoryQueue';
import { QueueRow } from './QueueRow';

export interface QueueSelection {
  id: string | null;
  onSelect: (id: string) => void;
}

export interface QueueHistoryState {
  open: boolean;
  onToggle: () => void;
  /** Share of tested theories that validated, 0–100; shown in the group header. */
  winRate: number | null;
}

export interface QueueAgentFilter {
  value: string;
  options: FilterDropdownOption[];
  accent?: string;
  onChange: (agentId: string) => void;
}

interface Props {
  groups: Record<QueueGroupKey, TheoryDto[]>;
  proposals: ProposalById;
  selection: QueueSelection;
  history: QueueHistoryState;
  filter: QueueAgentFilter;
  loading: boolean;
}

/**
 * The review desk's left column: the locked `ListRail` shell with theories grouped by urgency —
 * needs-decision first, history collapsed last. Empty groups render nothing so the rail reads
 * as an inbox, not a board of empty buckets.
 */
export function QueueRail({ groups, proposals, selection, history, filter, loading }: Props) {
  const { t } = useLingui();
  const total = QUEUE_GROUPS.reduce((sum, g) => sum + groups[g.key].length, 0);

  return (
    <ListRail
      title={t`Proposals`}
      count={total}
      loading={loading}
      isEmpty={total === 0}
      railTestId="proposals-rail"
      listTestId="proposals-queue"
      filter={
        <FilterDropdown
          label={t`Agent`}
          value={filter.value}
          options={filter.options}
          onChange={filter.onChange}
          active={!!filter.value}
          accent={filter.accent}
          size="sm"
          width={220}
          testId="proposals-agent-filter"
        />
      }
    >
      <div className="flex flex-col gap-1">
        {QUEUE_GROUPS.map(group => {
          const theories = groups[group.key];
          if (theories.length === 0) return null;
          const isHistory = group.key === 'history';
          const rows = theories.map(theory => (
            <QueueRow
              key={theory.id}
              theory={theory}
              proposal={proposalFor(theory, proposals)}
              group={group.key}
              selected={selection.id === theory.id}
              onSelect={() => selection.onSelect(theory.id)}
            />
          ));

          return (
            <section key={group.key} id={`queue-group-${group.key}`} data-testid={`queue-group-${group.key}`} className="flex flex-col gap-1 pb-2">
              {isHistory ? (
                <RowButton
                  onClick={history.onToggle}
                  aria-expanded={history.open}
                  data-testid="queue-history-toggle"
                  className="flex items-center gap-1.5 rounded-md px-2 py-1.5 hover:bg-card-2 transition-colors"
                >
                  <span className={cn('inline-flex shrink-0 text-muted transition-transform duration-[var(--motion-fast)]', history.open ? 'rotate-90' : 'rotate-0')}>
                    <ChevronRightIcon size={10} strokeWidth={2.5} />
                  </span>
                  <GroupLabel group={group} count={theories.length} />
                  {history.winRate != null && (
                    <span className="mono ml-auto text-caption text-muted">{t`win rate`} {history.winRate}%</span>
                  )}
                </RowButton>
              ) : (
                <div className="flex items-center gap-1.5 px-2 py-1.5">
                  <GroupLabel group={group} count={theories.length} />
                </div>
              )}
              {(!isHistory || history.open) && <div className="flex flex-col gap-0.5 fade-up">{rows}</div>}
            </section>
          );
        })}
      </div>
    </ListRail>
  );
}

function GroupLabel({ group, count }: { group: QueueGroupMeta; count: number }) {
  const { i18n } = useLingui();
  return (
    <>
      <span aria-hidden className={cn('size-1.5 rounded-full', TONE_BG[group.tone])} />
      <span className="text-caption font-semibold text-secondary">{i18n._(group.label)}</span>
      <span className="mono text-caption text-muted" data-testid={`queue-group-count-${group.key}`}>{count}</span>
    </>
  );
}
