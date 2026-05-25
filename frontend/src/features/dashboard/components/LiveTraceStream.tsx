// Live trace stream section — shows the 6 most recent agent calls.

import { useNavigate } from 'react-router-dom';
import { Pill } from '../../../components/ui/Pill';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Skeleton } from '../../../components/ui/Skeleton';
import type { AgentCallDto } from '../../../api/models';
import { modelColor, statusColor } from '../../../lib/colors';
import { fmtLatency, fmtTokens } from '../../../lib/format';

interface LiveTraceStreamProps {
  traces: AgentCallDto[];
  isLoading: boolean;
  freshIds: Set<string>;
}

export function LiveTraceStream({ traces, isLoading, freshIds }: LiveTraceStreamProps) {
  const navigate = useNavigate();

  return (
    <section className="rounded-lg bg-card px-3.5 pt-2.5 pb-1.5 flex flex-col shadow-[var(--shadow-card)]">
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

      <div className="grid grid-cols-[14px_1fr_auto_auto_auto_auto] gap-3.5 px-1 pb-2.5 text-[9.5px] font-bold text-muted tracking-[0.12em] uppercase font-mono border-b border-border-subtle">
        <span /><span>Trace ID</span><span>Model</span><span>Status</span><span>Tokens</span><span className="text-right">Latency</span>
      </div>

      {isLoading ? (
        <div className="py-3 flex flex-col gap-1.5">
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} height={26} className="rounded-sm" />)}
        </div>
      ) : traces.length === 0 ? (
        <div className="py-10">
          <EmptyState
            title="No traces yet"
            description="Route your agent through the Proxytrace proxy to start capturing traces."
          />
        </div>
      ) : (
        <div>
          {traces.map((t, i) => {
            const sc = statusColor(t.httpStatus);
            const isFresh = freshIds.has(t.id);
            return (
              <button
                key={t.id}
                onClick={() => navigate(`/traces?focus=${t.id}`)}
                className={`w-full text-left grid grid-cols-[14px_1fr_auto_auto_auto_auto] gap-3.5 items-center py-[7px] px-1 font-mono text-body-sm cursor-pointer transition-colors hover:bg-[color-mix(in_srgb,var(--accent-primary)_4%,transparent)] ${i === traces.length - 1 ? '' : 'border-b border-border-subtle'} ${isFresh ? 'slide-in' : ''}`}
              >
                <span
                  className="size-[7px] rounded-full"
                  style={{ background: sc, boxShadow: isFresh ? `0 0 10px ${sc}` : undefined }}
                />
                <span className="text-primary overflow-hidden text-ellipsis whitespace-nowrap">{t.id.slice(0, 16)}</span>
                <Pill label={t.model} color={modelColor(t.model)} size="sm" />
                <span className="text-[10.5px] font-semibold" style={{ color: sc }}>{t.httpStatus}</span>
                <span className="text-secondary text-right min-w-[50px]">{fmtTokens(t.inputTokens + t.outputTokens)}</span>
                <span className="text-muted text-right min-w-[56px]">{fmtLatency(t.durationMs)}</span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
