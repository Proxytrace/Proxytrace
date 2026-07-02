// Live trace stream section — most recent agent calls, grouped by conversation.

import { useMemo } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Skeleton } from '../../../components/ui/Skeleton';
import type { AgentCallListItemDto } from '../../../api/models';
import { buildRows } from '../../../lib/trace';
import { useNowTick } from '../hooks/useNowTick';
import { LiveStreamRow, LIVE_STREAM_GRID } from './LiveStreamRow';

interface LiveTraceStreamProps {
  traces: AgentCallListItemDto[];
  isLoading: boolean;
  freshIds: Set<string>;
}

export function LiveTraceStream({ traces, isLoading, freshIds }: LiveTraceStreamProps) {
  const { t } = useLingui();
  const navigate = useNavigate();
  const rows = useMemo(() => buildRows(traces), [traces]);
  const now = useNowTick(5000);

  return (
    <section data-testid="live-trace-stream" className="rounded-lg bg-card px-3.5 pt-2.5 pb-1.5 flex flex-col shadow-[var(--shadow-card)]">
      <header className="flex items-end justify-between mb-3">
        <div>
          <span className="text-caption text-accent-hover font-mono tracking-[0.18em] uppercase font-bold flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-success pulse-dot shadow-[0_0_10px_var(--success)]" />
            <Trans>Live feed</Trans>
          </span>
          <p className="text-body-sm text-muted mt-0.5 font-mono">
            <Trans>auto-refresh · {traces.length} most recent</Trans>
          </p>
        </div>
        <Button variant="link" className="text-body-sm" onClick={() => navigate('/traces')}>
          <Trans>View all →</Trans>
        </Button>
      </header>

      <div className={`${LIVE_STREAM_GRID} px-1.5 pb-2.5 text-caption font-bold text-muted tracking-[0.12em] uppercase font-mono border-b border-border-subtle`}>
        <span /><span><Trans>Message</Trans></span><span className="text-center"><Trans>Turns</Trans></span><span className="text-center"><Trans>Model</Trans></span><span className="text-center"><Trans>Status</Trans></span><span className="text-right"><Trans>Tokens</Trans></span><span className="text-right"><Trans>Latency</Trans></span><span className="text-right"><Trans>Age</Trans></span>
      </div>

      {isLoading ? (
        <div className="py-3 flex flex-col gap-1.5">
          {Array.from({ length: 12 }, (_, i) => <Skeleton key={i} height={26} className="rounded-sm" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="py-10">
          <EmptyState
            title={t`No traces yet`}
            description={t`Route your agent through the Proxytrace proxy to start capturing traces.`}
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
              now={now}
              onSelect={id => navigate(`/traces?focus=${id}`)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
