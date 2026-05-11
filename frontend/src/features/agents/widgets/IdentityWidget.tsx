import { useNavigate } from 'react-router-dom';
import type { AgentDto } from '../../../api/models';
import { PlayIcon, TrashIcon } from '../../../components/icons';
import { agentColor } from '../../../lib/colors';
import { fmtDate, fmtRelative } from '../../../lib/format';
import { EndpointSelector } from '../EndpointSelector';

interface Props {
  agent: AgentDto;
  onDelete: () => void;
  className?: string;
}

export function IdentityWidget({ agent, onDelete, className }: Props) {
  const navigate = useNavigate();
  const c = agentColor(agent.id);
  const initial = agent.name[0]?.toUpperCase() ?? '?';

  return (
    <div
      className={`bg-card rounded-lg relative shadow-[var(--shadow-card)] ${className ?? ''}`}
      style={{ borderTop: `2px solid ${c}` }}
    >
      <div className="px-4 py-3 flex items-center gap-3">
        <div
          className="flex items-center justify-center shrink-0 w-9 h-9 rounded-md"
          style={{
            background: `color-mix(in srgb, ${c} 14%, transparent)`,
            border: `1px solid color-mix(in srgb, ${c} 30%, transparent)`,
          }}
        >
          <span className="text-h2 font-bold font-mono" style={{ color: c }}>{initial}</span>
        </div>

        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-h1 font-semibold tracking-[-0.01em] m-0 truncate">{agent.name}</h2>
            <span className="px-1.5 py-px bg-card-2 text-secondary rounded-sm text-body-sm shrink-0">{agent.projectName}</span>
            <span
              className="px-1.5 py-px rounded-sm text-body-sm font-semibold shrink-0"
              style={{ background: `color-mix(in srgb, ${c} 14%, transparent)`, color: c }}
            >
              {agent.tools.length} tool{agent.tools.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-2 text-body-sm text-muted mt-0.5 flex-wrap">
            <span>Created {fmtDate(agent.createdAt)}</span>
            <span className="text-border">·</span>
            <span>Last used {agent.lastUsedAt ? fmtRelative(agent.lastUsedAt) : 'never'}</span>
          </div>
        </div>

        <EndpointSelector agent={agent} />

        <button
          onClick={() => navigate(`/playground?agentId=${agent.id}`)}
          className="btn-icon shrink-0"
          title="Open in playground"
          aria-label="Open in playground"
        >
          <PlayIcon size={14} />
        </button>

        <button
          onClick={onDelete}
          className="btn-icon btn-icon-danger shrink-0"
          title="Delete agent"
          aria-label="Delete agent"
        >
          <TrashIcon size={14} />
        </button>
      </div>
    </div>
  );
}
