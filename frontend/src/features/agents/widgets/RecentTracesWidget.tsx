import { useNavigate } from 'react-router-dom';
import { statusColor } from '../../../lib/colors';
import { fmtRelative, fmtDuration } from '../../../lib/format';
import { tracePreview } from '../../../lib/trace';
import { RowButton } from '../../../components/ui/RowButton';
import { Skeleton } from '../../../components/ui/Skeleton';
import { Button } from '../../../components/ui/Button';
import { useAgentRecentTraces } from '../hooks/useAgentRecentTraces';
import { Widget } from './Widget';

interface Props {
  agentId: string;
  className?: string;
}

export function RecentTracesWidget({ agentId, className }: Props) {
  const navigate = useNavigate();
  const { traces, isLoading } = useAgentRecentTraces(agentId);

  return (
    <Widget
      title="Recent traces"
      right={
        traces.length > 0 && (
          <Button variant="link" className="text-body-sm" onClick={() => navigate('/traces')}>
            View all ›
          </Button>
        )
      }
      className={className}
    >
      {isLoading && (
        <div className="flex flex-col gap-1.5" data-testid="agent-recent-traces-loading">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} height={28} className="rounded-md" />
          ))}
        </div>
      )}

      {!isLoading && traces.length === 0 && (
        <p className="text-body-sm text-muted" data-testid="agent-recent-traces-empty">No traces yet.</p>
      )}

      {!isLoading && traces.length > 0 && (
        <div className="flex flex-col gap-0.5" data-testid="agent-recent-traces-list">
          {traces.map(t => {
            const preview = tracePreview(t);
            return (
              <RowButton
                key={t.id}
                data-testid={`agent-recent-trace-${t.id}`}
                onClick={() => navigate(`/traces?focus=${t.id}`)}
                title={preview ?? 'Open trace'}
                className="flex items-center gap-2.5 rounded-md px-2 py-1.5 -mx-1 transition-colors duration-100 hover:bg-[var(--bg-wash-hover)]"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: statusColor(t.httpStatus) }}
                  aria-hidden
                />
                <span className="text-body-sm text-secondary truncate">
                  {preview ?? <span className="text-muted italic">No user message</span>}
                </span>
                <span className="ml-auto shrink-0 font-mono text-caption text-muted">{fmtDuration(t.durationMs)}</span>
                <span className="shrink-0 text-caption text-muted w-14 text-right">{fmtRelative(t.createdAt)}</span>
              </RowButton>
            );
          })}
        </div>
      )}
    </Widget>
  );
}
