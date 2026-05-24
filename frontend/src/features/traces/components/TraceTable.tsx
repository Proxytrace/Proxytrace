import { SkeletonList } from '../../../components/ui/Skeleton';
import type { AgentCallDto } from '../../../api/models';
import { COL_HEADERS, GRID_TEMPLATE } from '../tracesMeta';
import type { TraceRow } from '../tracesMeta';
import { FlatTraceRow } from './FlatTraceRow';
import { ConversationGroupRow } from './ConversationGroupRow';

interface Props {
  rows: TraceRow[];
  isFetching: boolean;
  selectedId: string | null;
  expandedConvs: Set<string>;
  onSelectTrace: (trace: AgentCallDto) => void;
  onToggleConv: (id: string) => void;
}

export function TraceTable({ rows, isFetching, selectedId, expandedConvs, onSelectTrace, onToggleConv }: Props) {
  return (
    <div className="fade-up bg-card rounded-[14px] overflow-hidden flex-1 min-h-0 flex flex-col shadow-[var(--shadow-card)] [animation-delay:120ms]">
      <div className="flex-1 min-h-0 overflow-y-auto [scrollbar-gutter:stable]">
        {/* Sticky column header */}
        <div
          className="grid px-4 py-[8px] border-b border-b-[rgba(255,255,255,0.06)] sticky top-0 z-10 bg-card"
          style={{ gridTemplateColumns: GRID_TEMPLATE }}
        >
          {COL_HEADERS.map((label, i) => (
            <span
              key={label}
              className={`text-body-sm font-semibold text-muted uppercase tracking-[0.06em] ${i === 7 ? 'text-right' : ''}`}
            >
              {label}
            </span>
          ))}
        </div>

        {rows.length === 0 ? (
          isFetching ? (
            <div className="p-3"><SkeletonList rows={10} height={36} gap={4} /></div>
          ) : (
            <div className="py-12 text-center text-muted text-body">No traces found.</div>
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
