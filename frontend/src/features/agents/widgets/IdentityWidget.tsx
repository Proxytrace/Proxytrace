import type { AgentDto } from '../../../api/models';
import { TrashIcon } from '../../../components/icons';
import { agentColor } from '../../../lib/colors';
import { fmtDate, fmtRelative } from '../../../lib/format';
import { EndpointSelector } from '../EndpointSelector';

interface Props {
  agent: AgentDto;
  onDelete: () => void;
  className?: string;
}

export function IdentityWidget({ agent, onDelete, className }: Props) {
  const c = agentColor(agent.id);
  const initial = agent.name[0]?.toUpperCase() ?? '?';

  return (
    <div
      className={`bg-card rounded-2xl relative ${className ?? ''}`}
      style={{ boxShadow: 'var(--shadow-card)', borderTop: `2px solid ${c}` }}
    >
      <div className="px-4 py-[10px] flex items-center gap-3">
        <div
          className="flex items-center justify-center shrink-0"
          style={{
            width: 36,
            height: 36,
            borderRadius: 'var(--radius-md)',
            background: `color-mix(in srgb, ${c} 14%, transparent)`,
            border: `1.5px solid color-mix(in srgb, ${c} 28%, transparent)`,
          }}
        >
          <span className="text-[15px] font-[800] font-mono" style={{ color: c }}>{initial}</span>
        </div>

        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-[15px] font-bold tracking-[-0.01em] m-0 truncate">{agent.name}</h2>
            <span className="px-[6px] py-[1px] bg-card-2 text-muted rounded-md text-[10.5px] shrink-0">{agent.projectName}</span>
            <span
              className="px-[6px] py-[1px] rounded-md text-[10.5px] font-semibold shrink-0"
              style={{ background: `color-mix(in srgb, ${c} 12%, transparent)`, color: c }}
            >
              {agent.tools.length} tool{agent.tools.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10.5px] text-muted mt-[2px] flex-wrap">
            <span>Created {fmtDate(agent.createdAt)}</span>
            <span>·</span>
            <span>Last used {agent.lastUsedAt ? fmtRelative(agent.lastUsedAt) : 'never'}</span>
          </div>
        </div>

        <EndpointSelector agent={agent} />

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
