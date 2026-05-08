import type { AgentDto } from '../../../api/models';
import { agentColor } from '../../../lib/colors';
import { EmptyState } from '../../../components/ui/EmptyState';

interface Props {
  agents: AgentDto[];
  value: string;
  onChange: (id: string) => void;
}

export function AgentStep({ agents, value, onChange }: Props) {
  if (agents.length === 0) {
    return <EmptyState title="No agents available" description="Create an agent before building a test suite." />;
  }
  return (
    <div className="max-w-[640px] mx-auto flex flex-col gap-3">
      <p className="text-[12.5px] text-muted m-0">Which agent should this suite test?</p>
      <div className="grid grid-cols-2 gap-2">
        {agents.map(a => {
          const c = agentColor(a.id);
          const selected = value === a.id;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onChange(a.id)}
              className="text-left rounded-[10px] cursor-pointer transition-colors duration-150"
              style={{
                padding: '12px 14px',
                border: `1px solid ${selected ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                background: selected ? 'var(--accent-subtle)' : 'var(--bg-card)',
              }}
            >
              <div className="flex items-center gap-2">
                <span className="size-[7px] rounded-full shrink-0" style={{ background: c }} />
                <span className="text-[13px] font-semibold">{a.name}</span>
              </div>
              <div className="text-[11px] text-muted mt-1">{a.projectName}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
