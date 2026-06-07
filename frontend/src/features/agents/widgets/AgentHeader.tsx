import { useNavigate } from 'react-router-dom';
import type { AgentDto, AgentOverviewDto } from '../../../api/models';
import { Button, IconButton } from '../../../components/ui/Button';
import { PlayFilledIcon, TrashIcon, SparklesIcon } from '../../../components/icons';
import { agentColor, modelColor } from '../../../lib/colors';
import { fmtRelative } from '../../../lib/format';
import { EndpointSelector } from '../EndpointSelector';
import { useAgentVersions } from '../hooks/useAgentVersions';
import { AgentActionsMenu } from './AgentActionsMenu';

interface Props {
  agent: AgentDto;
  overview?: AgentOverviewDto;
  onDelete: () => void;
  className?: string;
}

export function AgentHeader({ agent, overview, onDelete, className }: Props) {
  const navigate = useNavigate();
  const { latestVersion } = useAgentVersions(agent.id);
  const c = agentColor(agent.id);
  const mc = modelColor(agent.endpointName);
  const initial = agent.name[0]?.toUpperCase() ?? '?';
  const proposals = overview?.counts.openProposalCount ?? 0;
  const traces = overview?.summary.totalTraces ?? 0;

  return (
    <section
      data-testid="agent-header"
      className={`bg-card rounded-lg overflow-hidden shadow-[var(--shadow-card)] ${className ?? ''}`}
    >
      <div className="h-1" style={{ background: `linear-gradient(90deg, ${c}, color-mix(in srgb, ${c} 27%, transparent))` }} />
      <div className="px-5 py-4 flex items-start gap-4 flex-wrap">
        <div
          className="flex items-center justify-center shrink-0 w-[52px] h-[52px] rounded-lg"
          style={{
            background: `color-mix(in srgb, ${c} 13%, transparent)`,
            border: `2px solid color-mix(in srgb, ${c} 27%, transparent)`,
            boxShadow: `0 0 24px color-mix(in srgb, ${c} 20%, transparent)`,
          }}
        >
          <span className="text-h1 font-bold font-mono" style={{ color: c }}>{initial}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
            <h2 data-testid="agent-name" className="text-h1 font-semibold tracking-[-0.02em] m-0 truncate">{agent.name}</h2>
            {latestVersion > 0 && (
              <span
                className="px-2 py-px rounded-sm text-body-sm font-semibold font-mono shrink-0"
                style={{ background: `color-mix(in srgb, ${c} 14%, transparent)`, color: c }}
              >
                v{latestVersion}
              </span>
            )}
            {proposals > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/proposals?agentId=${agent.id}`)}
                data-testid="agent-proposals-pill"
                leftIcon={<SparklesIcon size={11} />}
                className="rounded-full text-accent bg-accent-subtle hover:text-accent-hover shadow-[var(--shadow-pill)]"
              >
                {proposals} proposal{proposals > 1 ? 's' : ''} ready
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap text-body-sm text-muted">
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-mono font-medium"
              style={{
                background: `color-mix(in srgb, ${mc} 12%, transparent)`,
                color: mc,
                border: `1px solid color-mix(in srgb, ${mc} 20%, transparent)`,
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: mc }} />
              {agent.endpointName}
            </span>
            <span>{agent.projectName}</span>
            <span aria-hidden>·</span>
            <span>{traces} trace{traces === 1 ? '' : 's'}</span>
            {agent.lastUsedAt && (
              <>
                <span aria-hidden>·</span>
                <span>last used {fmtRelative(agent.lastUsedAt)}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <EndpointSelector agent={agent} />
          <Button
            size="sm"
            leftIcon={<PlayFilledIcon size={12} />}
            onClick={() => navigate(`/suites?agentId=${agent.id}`)}
            data-testid="agent-run-btn"
          >
            Run
          </Button>
          <AgentActionsMenu agentId={agent.id} />
          <IconButton
            danger
            onClick={onDelete}
            title="Delete agent"
            aria-label="Delete agent"
            data-testid="agent-delete-btn"
          >
            <TrashIcon size={14} />
          </IconButton>
        </div>
      </div>
    </section>
  );
}
