import { Button } from '../../../components/ui/Button';
import { SkeletonList } from '../../../components/ui/Skeleton';
import type { AgentCallListItemDto } from '../../../api/models';
import { COL_HEADERS, COL_VIS_CLS, GRID_TEMPLATE, GRID_TEMPLATE_NARROW, TRACE_GRID_CLS } from '../tracesMeta';
import type { TraceRow } from '../tracesMeta';
import { cn } from '../../../lib/cn';
import { FlatTraceRow } from './FlatTraceRow';
import { ConversationGroupRow } from './ConversationGroupRow';

interface Props {
  rows: TraceRow[];
  isFetching: boolean;
  selectedId: string | null;
  expandedConvs: Set<string>;
  onSelectTrace: (trace: AgentCallListItemDto) => void;
  onToggleConv: (id: string) => void;
}

export function TraceTable({ rows, isFetching, selectedId, expandedConvs, onSelectTrace, onToggleConv }: Props) {
  return (
    <div
      data-testid="trace-table"
      className="fade-up bg-card rounded-[14px] overflow-hidden flex-1 min-h-0 flex flex-col shadow-[var(--shadow-card)] [animation-delay:120ms] @container"
      style={{ '--trace-grid': GRID_TEMPLATE, '--trace-grid-narrow': GRID_TEMPLATE_NARROW } as React.CSSProperties}
    >
      <div className="flex-1 min-h-0 overflow-y-auto [scrollbar-gutter:stable]">
        {/* Sticky column header */}
        <div
          className={cn('grid px-4 py-[8px] border-b border-b-[rgba(255,255,255,0.06)] sticky top-0 z-10 bg-card', TRACE_GRID_CLS)}
        >
          {COL_HEADERS.map((label, i) => (
            <span
              key={label}
              className={cn(
                'text-body-sm font-semibold text-muted uppercase tracking-[0.06em]',
                i === 7 && 'text-right',
                COL_VIS_CLS[i],
              )}
            >
              {label}
            </span>
          ))}
        </div>

        {rows.length === 0 ? (
          isFetching ? (
            <div className="p-3"><SkeletonList rows={10} height={36} gap={4} /></div>
          ) : (
            <div data-testid="traces-empty-state" className="py-12 flex flex-col items-center gap-2 text-center">
              <span className="text-muted text-body">No traces found.</span>
              <Button variant="link" asChild>
                <a
                  data-testid="traces-proxy-docs-link"
                  href="/docs/guide/proxy-setup.html"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  How to wire the proxy? →
                </a>
              </Button>
            </div>
          )
        ) : (
          rows.map(row =>
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
          )
        )}
      </div>
    </div>
  );
}
