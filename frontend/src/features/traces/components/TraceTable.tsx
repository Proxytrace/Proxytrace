import { SkeletonList } from '../../../components/ui/Skeleton';
import type { AgentCallListItemDto } from '../../../api/models';
import { COL_HEADERS, COL_VIS_CLS, GRID_TEMPLATE, GRID_TEMPLATE_NARROW, SORT_FIELD_BY_COL, TRACE_GRID_CLS, traceListView } from '../tracesMeta';
import type { TraceRow, TraceSort, TraceSortField } from '../tracesMeta';
import { cn } from '../../../lib/cn';
import { FlatTraceRow } from './FlatTraceRow';
import { ConversationGroupRow } from './ConversationGroupRow';
import { TracesEmptyState } from './TracesEmptyState';
import { Trans, useLingui } from '@lingui/react/macro';
import { COL_HEADER_LABELS } from '../tracesMeta';
import { Tooltip } from '../../../components/ui/Tooltip';
import { AlertTriangleIcon, ArrowDownIcon, ArrowUpIcon } from '../../../components/icons';

interface Props {
  rows: TraceRow[];
  isFetching: boolean;
  /** A narrowing filter (agent or search) is active — empty means "no match", not "no traces yet". */
  filtered: boolean;
  selectedId: string | null;
  expandedConvs: Set<string>;
  sort: TraceSort;
  /** Header click: a new column sorts descending; the active column toggles direction. */
  onSortChange: (field: TraceSortField) => void;
  onSelectTrace: (trace: AgentCallListItemDto) => void;
  onToggleConv: (id: string) => void;
}

// eslint-disable-next-line lingui/no-unlocalized-strings -- CSS utility classes, not UI copy
const HEADER_TEXT_CLS = 'text-body-sm font-semibold text-muted uppercase tracking-[0.06em]';

function SortableHeader({ label, field, sort, onSortChange, alignRight }: {
  label: string;
  field: TraceSortField;
  sort: TraceSort;
  onSortChange: (field: TraceSortField) => void;
  alignRight: boolean;
}) {
  const active = sort.field === field;
  return (
    // eslint-disable-next-line no-restricted-syntax -- bespoke sortable column header; Button's ghost padding/height doesn't fit the dense sticky header row
    <button
      type="button"
      data-testid={`traces-sort-${field}`}
      onClick={() => onSortChange(field)}
      className={cn(
        HEADER_TEXT_CLS,
        'inline-flex items-center gap-1 cursor-pointer bg-transparent p-0 border-0',
        'transition-colors duration-[var(--motion-fast)] hover:text-secondary',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent-primary)_60%,transparent)] rounded-sm',
        alignRight && 'justify-end',
        active && 'text-accent-text',
      )}
    >
      {label}
      {active && (sort.desc ? <ArrowDownIcon size={10} /> : <ArrowUpIcon size={10} />)}
    </button>
  );
}

export function TraceTable({ rows, isFetching, filtered, selectedId, expandedConvs, sort, onSortChange, onSelectTrace, onToggleConv }: Props) {
  const { i18n } = useLingui();
  return (
    <div
      data-testid="trace-table"
      className="fade-up bg-card rounded-lg overflow-hidden flex-1 min-h-0 flex flex-col shadow-[var(--shadow-card)] [animation-delay:120ms] @container"
      style={{ '--trace-grid': GRID_TEMPLATE, '--trace-grid-narrow': GRID_TEMPLATE_NARROW } as React.CSSProperties}
    >
      <div className="flex-1 min-h-0 overflow-y-auto [scrollbar-gutter:stable]">
        {/* Sticky column header */}
        <div
          className={cn('grid px-4 py-2 border-b border-hairline sticky top-0 z-10 bg-card', TRACE_GRID_CLS)}
        >
          {COL_HEADERS.map((header, i) => {
            const headerLabel = i18n._(COL_HEADER_LABELS[i]);
            const isAnomaly = header === '';
            const sortField = SORT_FIELD_BY_COL[i];
            const alignRight = i === COL_HEADERS.length - 1;
            if (sortField) {
              return (
                <span key={i} className={cn(alignRight && 'text-right', COL_VIS_CLS[i])}>
                  <SortableHeader
                    label={headerLabel}
                    field={sortField}
                    sort={sort}
                    onSortChange={onSortChange}
                    alignRight={alignRight}
                  />
                </span>
              );
            }
            return (
              <span
                key={i}
                className={cn(
                  HEADER_TEXT_CLS,
                  isAnomaly && 'flex items-center justify-center',
                  alignRight && 'text-right',
                  COL_VIS_CLS[i],
                )}
              >
                {isAnomaly ? (
                  <Tooltip content={headerLabel}>
                    <span aria-label={headerLabel} className="inline-flex text-muted">
                      <AlertTriangleIcon size={13} />
                    </span>
                  </Tooltip>
                ) : (
                  headerLabel
                )}
              </span>
            );
          })}
        </div>

        {(() => {
          const view = traceListView(rows.length, isFetching, filtered);
          if (view === 'loading') return <div className="p-3"><SkeletonList rows={10} height={36} gap={4} /></div>;
          if (view === 'empty-filtered') return (
            <div data-testid="traces-empty-state" className="py-12 flex flex-col items-center gap-1 text-center">
              <span className="text-secondary text-body"><Trans>No traces match your filters.</Trans></span>
              <span className="text-muted text-body-sm"><Trans>Try widening the time range, agent, or search.</Trans></span>
            </div>
          );
          if (view === 'empty-setup') return <TracesEmptyState />;
          return rows.map(row =>
            row.type === 'flat' ? (
              <FlatTraceRow
                key={row.trace.id}
                trace={row.trace}
                selected={row.trace.id === selectedId}
                onClick={() => onSelectTrace(row.trace)}
              />
            ) : (
              <ConversationGroupRow
                key={row.conversationId}
                group={row}
                expanded={expandedConvs.has(row.conversationId)}
                onToggle={() => onToggleConv(row.conversationId)}
                selectedId={selectedId}
                onSelectTrace={onSelectTrace}
              />
            ),
          );
        })()}
      </div>
    </div>
  );
}
