import { agentColor } from '../../../lib/colors';
import { fmtLatency } from '../../../lib/format';
import { RowButton } from '../../../components/ui/RowButton';
import type { AgentDto, AgentBreakdownDto } from '../../../api/models';

interface Props {
  agents: AgentDto[];
  agentBreakdown: AgentBreakdownDto[];
  agentFilter: string;
  p95: number | null;
  onFilterChange: (agentId: string) => void;
}

export function AgentFilterCards({ agents, agentBreakdown, agentFilter, p95, onFilterChange }: Props) {
  if (agents.length === 0) return null;

  return (
    <div className="fade-up grid gap-2 p-1 shrink-0 [animation-delay:40ms] grid-cols-[repeat(auto-fill,minmax(160px,1fr))]">
      {agents.map(a => {
        const c = agentColor(a.id);
        const isActive = agentFilter === a.id;
        const callCount = agentBreakdown.find(b => b.agentId === a.id)?.callCount ?? 0;
        return (
          <RowButton
            key={a.id}
            data-testid={`agent-filter-card-${a.id}`}
            onClick={() => onFilterChange(isActive ? '' : a.id)}
            className="bg-card rounded-xl px-[14px] py-3 relative overflow-hidden transition-[box-shadow] duration-[150ms]"
            style={{
              boxShadow: isActive
                ? `0 0 0 1.5px color-mix(in srgb, ${c} 53%, transparent), 0 4px 16px -6px color-mix(in srgb, ${c} 38%, transparent)`
                : 'var(--shadow-card)',
            }}
          >
            <div
              className="absolute top-0 left-0 right-0 h-[2px]"
              style={{ background: `linear-gradient(90deg, ${c}, color-mix(in srgb, ${c} 28%, transparent))` }}
            />
            <div className="text-[11.5px] font-semibold mb-[6px] overflow-hidden text-ellipsis whitespace-nowrap pr-1">
              {a.name}
            </div>
            <div className="flex items-baseline gap-[5px]">
              <span
                className="text-[20px] font-bold tracking-[-0.02em]"
                style={{ color: isActive ? c : 'var(--text-primary)' }}
              >
                {callCount || '—'}
              </span>
              <span className="text-caption text-muted">traces</span>
            </div>
          </RowButton>
        );
      })}

      {p95 != null && (
        <div className="bg-card rounded-xl px-[14px] py-3 relative overflow-hidden shadow-[var(--shadow-card)]">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-[linear-gradient(90deg,var(--teal),transparent)]" />
          <div className="text-[11.5px] font-semibold mb-[6px] text-muted">p95 Latency</div>
          <div className="flex items-baseline gap-[5px]">
            <span className="text-[20px] font-bold tracking-[-0.02em] font-mono text-teal">{fmtLatency(p95)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
