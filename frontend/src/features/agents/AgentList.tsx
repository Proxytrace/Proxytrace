import { useState } from 'react';
import type { AgentListItemDto } from '../../api/models';
import { agentColor } from '../../lib/colors';
import { selectionRowStyle, selectionBarStyle, SELECTION_ROW_INACTIVE } from '../../lib/selectionRow';
import { cn } from '../../lib/cn';
import { fmtRelative } from '../../lib/format';
import { ListRail } from '../../components/ui/ListRail';
import { RowButton } from '../../components/ui/RowButton';
import { EmptyState } from '../../components/ui/EmptyState';

interface Props {
  agents: AgentListItemDto[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isLoading: boolean;
  showSystem: boolean;
  onToggleSystem?: () => void;
}

export function AgentList({ agents, selectedId, onSelect, isLoading, showSystem, onToggleSystem }: Props) {
  const [search, setSearch] = useState('');

  const q = search.trim().toLowerCase();
  const filtered = q
    ? agents.filter(a =>
        a.name.toLowerCase().includes(q)
        || a.projectName.toLowerCase().includes(q)
        || a.endpointName.toLowerCase().includes(q),
      )
    : agents;

  return (
    <ListRail
      listTestId="agent-list"
      title="Agents"
      count={agents.length}
      search={{ value: search, onChange: setSearch, placeholder: 'Search agents…' }}
      filter={onToggleSystem ? (
        // eslint-disable-next-line no-restricted-syntax -- bespoke labeled switch-pill (track + inline label in one tinted control)
        <button
          type="button"
          role="switch"
          aria-checked={showSystem}
          onClick={onToggleSystem}
          title={showSystem ? 'Hide system agents' : 'Show system agents'}
          className={cn(
            'inline-flex items-center gap-2 px-3 py-1.5 rounded-[10px] text-[12.5px] font-medium cursor-pointer transition-colors duration-200 border-none',
            showSystem
              ? 'text-accent bg-accent-subtle shadow-[inset_0_0_0_1px_var(--accent-primary)]'
              : 'text-secondary bg-card-2',
          )}
        >
          <span
            className={`w-7 h-4 rounded-full relative transition-colors duration-200 ${showSystem ? 'bg-accent' : 'bg-[rgba(255,255,255,0.12)]'}`}
            aria-hidden="true"
          >
            <span
              className={cn(
                'absolute top-[2px] w-3 h-3 rounded-full bg-white transition-[left] duration-200',
                showSystem ? 'left-[14px]' : 'left-[2px]',
              )}
            />
          </span>
          System Agents
        </button>
      ) : undefined}
      loading={isLoading}
      isEmpty={filtered.length === 0}
      empty={<EmptyState title={search ? 'No matches' : 'No agents yet'} description={search ? 'Clear the search to see all agents.' : undefined} />}
    >
      <div className="flex flex-col gap-1.5">
        {filtered.map(a => (
          <AgentRow
            key={a.id}
            agent={a}
            selected={selectedId === a.id}
            onClick={() => onSelect(a.id)}
          />
        ))}
      </div>
    </ListRail>
  );
}

function AgentRow({ agent, selected, onClick }: { agent: AgentListItemDto; selected: boolean; onClick: () => void }) {
  const c = agentColor(agent.id);
  const initial = agent.name[0]?.toUpperCase() ?? '?';

  return (
    <RowButton
      onClick={onClick}
      data-testid={`agent-card-${agent.id}`}
      className={`rounded-lg relative overflow-hidden transition-[box-shadow,background-color] duration-150 px-3 py-2.5 pl-[14px] ${
        selected ? '' : SELECTION_ROW_INACTIVE
      }`}
      style={selected ? selectionRowStyle(c) : undefined}
    >
      {selected && (
        <div aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px]" style={selectionBarStyle(c)} />
      )}
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className="flex items-center justify-center shrink-0 w-[30px] h-[30px] rounded-md"
          style={{
            background: `color-mix(in srgb, ${c} 12%, transparent)`,
            border: `1px solid color-mix(in srgb, ${c} 30%, transparent)`,
          }}
        >
          <span className="text-title font-bold font-mono" style={{ color: c }}>{initial}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-body font-semibold text-primary truncate">{agent.name}</div>
          <div className="text-caption text-muted truncate font-mono">{agent.endpointName}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-1.5 text-caption text-muted pl-[40px]">
        <span className="truncate">{agent.projectName}</span>
        <span className="text-border">·</span>
        <span className="shrink-0">{agent.toolCount} tool{agent.toolCount !== 1 ? 's' : ''}</span>
        <span className="ml-auto shrink-0 font-mono">{agent.lastUsedAt ? fmtRelative(agent.lastUsedAt) : 'never'}</span>
      </div>
    </RowButton>
  );
}
