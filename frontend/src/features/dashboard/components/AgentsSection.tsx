// Agents grid section — shows up to 8 agents with per-agent trace counts.

import { Trans, Plural, useLingui } from '@lingui/react/macro';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { Pill } from '../../../components/ui/Pill';
import { RowButton } from '../../../components/ui/RowButton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { SparklesIcon } from '../../../components/icons';
import type { AgentListItemDto, AgentBreakdownDto } from '../../../api/models';
import { agentColor } from '../../../lib/colors';
import { agentCallCount } from '../dashboardMeta';

interface AgentsSectionProps {
  agents: AgentListItemDto[];
  agentBreakdown: AgentBreakdownDto[] | undefined;
}

export function AgentsSection({ agents, agentBreakdown }: AgentsSectionProps) {
  const { t } = useLingui();
  const navigate = useNavigate();
  const visibleAgents = agents.filter(a => !a.isSystemAgent);

  return (
    <div data-testid="dashboard-agents-section" className="fade-up rounded-lg bg-card flex flex-col shadow-[var(--shadow-card)] [animation-delay:200ms]">
      <header className="flex items-center justify-between gap-3 px-3 pt-2.5 pb-1.5">
        <div className="min-w-0">
          <h3 className="text-h2 font-semibold"><Trans>Agents</Trans></h3>
          <p className="text-body-sm text-muted mt-0.5 font-mono">
            <Trans><span data-testid="dashboard-agents-count">{visibleAgents.length}</span> detected · tap to inspect</Trans>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-2.5 py-1.5 rounded-md text-body-sm font-semibold text-accent-hover inline-flex items-center gap-1.5 bg-[linear-gradient(135deg,var(--accent-subtle),color-mix(in_srgb,var(--teal)_8%,transparent))]">
            <SparklesIcon size={11} /> <Trans>2 proposals</Trans>
          </div>
          <Button variant="secondary" size="sm" onClick={() => navigate('/agents')}>
            <Trans>Manage</Trans>
          </Button>
        </div>
      </header>
      <div className="px-3 pb-3">
        {visibleAgents.length === 0 ? (
          <EmptyState
            title={t`No agents yet`}
            description={t`Agents are detected automatically when you route traffic through the Proxytrace proxy.`}
          />
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {visibleAgents.slice(0, 8).map(a => {
              const c = agentColor(a.id);
              const traces = agentCallCount(agentBreakdown ?? [], a.id);
              return (
                <RowButton
                  key={a.id}
                  data-testid={`dashboard-agent-${a.id}`}
                  onClick={() => navigate(`/agents?id=${a.id}`)}
                  className="relative overflow-hidden px-3 pt-[9px] pb-2 bg-card-2 rounded-md flex flex-col gap-1.5 shadow-[var(--shadow-pill)] transition-colors hover:bg-[color-mix(in_srgb,var(--accent-primary)_4%,transparent)]"
                >
                  <div className="absolute top-0 left-0 right-0 h-0.5 opacity-70" style={{ background: c }} />
                  <div className="flex items-start justify-between gap-1.5">
                    <span className="text-title font-semibold leading-tight truncate">{a.name}</span>
                    {a.toolCount > 0 && (
                      <span className="text-[9.5px] px-1.5 py-px bg-card rounded-sm text-muted font-mono shrink-0">{a.toolCount}t</span>
                    )}
                  </div>
                  <div><Pill label={a.endpointName} color={c} size="sm" /></div>
                  <div className="flex items-end justify-between mt-auto">
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-[22px] font-extrabold tabular-nums tracking-[-0.025em] leading-none" style={{ color: c }}>
                          {traces}
                        </span>
                        <span className="text-[10.5px] text-muted font-semibold"><Trans>traces</Trans></span>
                      </div>
                      <div className="text-[9.5px] text-muted mt-0.5 font-mono">
                        <Plural value={a.toolCount} one="# tool" other="# tools" />
                      </div>
                    </div>
                  </div>
                </RowButton>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
