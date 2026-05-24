// Agents grid section — shows up to 8 agents with per-agent trace counts.

import { useNavigate } from 'react-router-dom';
import { Pill } from '../../../components/ui/Pill';
import { EmptyState } from '../../../components/ui/EmptyState';
import { SparklesIcon } from '../../../components/icons';
import type { AgentDto, AgentBreakdownDto } from '../../../api/models';
import { agentColor } from '../../../lib/colors';
import { agentCallCount } from '../dashboardMeta';

interface AgentsSectionProps {
  agents: AgentDto[];
  agentBreakdown: AgentBreakdownDto[] | undefined;
}

export function AgentsSection({ agents, agentBreakdown }: AgentsSectionProps) {
  const navigate = useNavigate();

  return (
    <div className="fade-up rounded-lg bg-card flex flex-col shadow-[var(--shadow-card)] [animation-delay:200ms]">
      <header className="flex items-center justify-between gap-3 px-3 pt-2.5 pb-1.5">
        <div className="min-w-0">
          <h3 className="text-h2 font-semibold">Agents</h3>
          <p className="text-body-sm text-muted mt-0.5 font-mono">{agents.length} detected · tap to inspect</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-2.5 py-1.5 rounded-md text-body-sm font-semibold text-accent-hover inline-flex items-center gap-1.5 bg-[linear-gradient(135deg,var(--accent-subtle),color-mix(in_srgb,var(--teal)_8%,transparent))]">
            <SparklesIcon size={11} /> 2 proposals
          </div>
          <button
            onClick={() => navigate('/agents')}
            className="text-body-sm text-secondary px-3 py-1.5 bg-card-2 rounded-md shadow-[var(--shadow-pill)] cursor-pointer transition-colors hover:text-primary"
          >
            Manage
          </button>
        </div>
      </header>
      <div className="px-3 pb-3">
        {agents.length === 0 ? (
          <EmptyState
            title="No agents yet"
            description="Agents are detected automatically when you route traffic through the Trsr proxy."
          />
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {agents.slice(0, 8).map(a => {
              const c = agentColor(a.id);
              const traces = agentCallCount(agentBreakdown ?? [], a.id);
              return (
                <button
                  key={a.id}
                  onClick={() => navigate(`/agents?id=${a.id}`)}
                  className="relative overflow-hidden text-left px-3 pt-[9px] pb-2 bg-card-2 rounded-md flex flex-col gap-1.5 shadow-[var(--shadow-pill)] cursor-pointer transition-colors hover:bg-[color-mix(in_srgb,var(--accent-primary)_4%,transparent)]"
                >
                  <div className="absolute top-0 left-0 right-0 h-0.5 opacity-70" style={{ background: c }} />
                  <div className="flex items-start justify-between gap-1.5">
                    <span className="text-title font-semibold leading-tight truncate">{a.name}</span>
                    {a.tools.length > 0 && (
                      <span className="text-[9.5px] px-1.5 py-px bg-card rounded-sm text-muted font-mono shrink-0">{a.tools.length}t</span>
                    )}
                  </div>
                  <div><Pill label={a.endpointName} color={c} size="sm" /></div>
                  <div className="flex items-end justify-between mt-auto">
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-[22px] font-extrabold tabular-nums tracking-[-0.025em] leading-none" style={{ color: c }}>
                          {traces}
                        </span>
                        <span className="text-[10.5px] text-muted font-semibold">traces</span>
                      </div>
                      <div className="text-[9.5px] text-muted mt-0.5 font-mono">
                        {a.tools.length} tool{a.tools.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
