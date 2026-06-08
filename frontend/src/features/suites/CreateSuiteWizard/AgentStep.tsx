import { useMemo, useState } from 'react';
import type { AgentDto } from '../../../api/models';
import { agentColor } from '../../../lib/colors';
import { EmptyState } from '../../../components/ui/EmptyState';
import { RowButton } from '../../../components/ui/RowButton';
import { Switch } from '../../../components/ui/Switch';

interface Props {
  agents: AgentDto[];
  value: string;
  onChange: (id: string) => void;
}

export function AgentStep({ agents, value, onChange }: Props) {
  const [showSystem, setShowSystem] = useState(false);

  const hasSystem = useMemo(() => agents.some(a => a.isSystemAgent), [agents]);
  const visible = useMemo(
    () => (showSystem ? agents : agents.filter(a => !a.isSystemAgent)),
    [agents, showSystem],
  );

  if (agents.length === 0) {
    return <EmptyState title="No agents available" description="Create an agent before building a test suite." />;
  }

  return (
    <div data-testid="wizard-step-agent" className="max-w-[640px] mx-auto flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12.5px] text-muted m-0">Which agent should this suite test?</p>
        {hasSystem && (
          <label className="flex items-center gap-2 text-[12px] text-secondary cursor-pointer select-none">
            System agents
            <Switch
              checked={showSystem}
              onChange={setShowSystem}
              aria-label="System agents"
              data-testid="wizard-agent-show-system"
            />
          </label>
        )}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="No agents to show"
          description="Only system agents exist — turn on “System agents” to select one."
        />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {visible.map(a => {
            const c = agentColor(a.id);
            const selected = value === a.id;
            return (
              <RowButton
                key={a.id}
                data-testid={`wizard-agent-option-${a.id}`}
                onClick={() => onChange(a.id)}
                className="rounded-[10px] transition-colors duration-150"
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
              </RowButton>
            );
          })}
        </div>
      )}
    </div>
  );
}
