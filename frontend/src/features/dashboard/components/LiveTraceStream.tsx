// Live trace stream section — most recent agent calls, grouped by conversation.

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Skeleton } from '../../../components/ui/Skeleton';
import type { AgentCallDto } from '../../../api/models';
import { buildRows } from '../../../lib/trace';
import { LiveStreamRow, LIVE_STREAM_GRID } from './LiveStreamRow';

interface LiveTraceStreamProps {
  traces: AgentCallDto[];
  isLoading: boolean;
  freshIds: Set<string>;
}

export function LiveTraceStream({ traces, isLoading, freshIds }: LiveTraceStreamProps) {
  const navigate = useNavigate();
  const rows = useMemo(() => buildRows(traces), [traces]);

  return (
    <section data-testid="live-trace-stream" className="rounded-lg bg-card px-3.5 pt-2.5 pb-1.5 flex flex-col shadow-[var(--shadow-card)]">
      <header className="flex items-end justify-between mb-3">
        <div>
          <h3 className="text-h2 font-semibold flex items-center gap-2">
            <span className="size-[7px] rounded-full bg-accent-hover pulse-dot shadow-[0_0_10px_var(--accent-hover)]" />
            Live trace stream
          </h3>
          <p className="text-body-sm text-muted mt-[3px] font-mono">
            auto-refresh · {traces.length} most recent
          </p>
        </div>
        <button onClick={() => navigate('/traces')} className="text-body-sm font-medium text-accent-hover cursor-pointer">
          View all →
        </button>
      </header>

      <div className={`${LIVE_STREAM_GRID} px-1.5 pb-2.5 text-[9.5px] font-bold text-muted tracking-[0.12em] uppercase font-mono border-b border-border-subtle`}>
        <span /><span>Message</span><span className="text-center">Turns</span><span className="text-center">Model</span><span className="text-center">Status</span><span className="text-right">Tokens</span><span className="text-right">Latency</span>
      </div>

      {isLoading ? (
        <div className="py-3 flex flex-col gap-1.5">
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} height={26} className="rounded-sm" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="py-10">
          <EmptyState
            title="No traces yet"
            description="Route your agent through the Proxytrace proxy to start capturing traces."
          />
        </div>
      ) : (
        <div>
          {rows.map((row, i) => (
            <LiveStreamRow
              key={row.type === 'flat' ? row.trace.id : row.conversationId}
              row={row}
              freshIds={freshIds}
              isLast={i === rows.length - 1}
              onSelect={id => navigate(`/traces?focus=${id}`)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
