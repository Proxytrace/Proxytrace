import { useState } from 'react';
import type { AgentListItemDto } from '../../api/models';
import { SearchIcon, XIcon } from '../../components/icons';
import { agentColor } from '../../lib/colors';
import { cn } from '../../lib/cn';
import { fmtRelative } from '../../lib/format';
import { IconButton } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { RowButton } from '../../components/ui/RowButton';
import { SkeletonList } from '../../components/ui/Skeleton';

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
    <div className="flex flex-col gap-3 min-h-0">
      <Input
        leftAddon={<SearchIcon size={13} />}
        rightAddon={search ? (
          <IconButton size="sm" onClick={() => setSearch('')} aria-label="Clear search"><XIcon size={12} /></IconButton>
        ) : undefined}
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search agents…"
      />

      {onToggleSystem && (
        // eslint-disable-next-line no-restricted-syntax -- bespoke labeled switch-pill (track + inline label in one tinted control)
        <button
          type="button"
          role="switch"
          aria-checked={showSystem}
          onClick={onToggleSystem}
          title={showSystem ? 'Hide system agents' : 'Show system agents'}
          className={cn(
            'self-start inline-flex items-center gap-2 px-3 py-2 rounded-[10px] text-[12.5px] font-medium cursor-pointer transition-colors duration-200 border-none',
            showSystem
              ? 'text-accent bg-accent-subtle shadow-[inset_0_0_0_1px_var(--accent-primary),var(--shadow-pill)]'
              : 'text-secondary bg-card shadow-[var(--shadow-pill)]',
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
      )}

      <div data-testid="agent-list" className="flex-1 min-h-0 overflow-y-auto pr-[2px] flex flex-col gap-1.5">
        {isLoading && (
          <SkeletonList rows={6} height={64} gap={6} />
        )}
        {!isLoading && filtered.length === 0 && (
          <div className="text-body text-muted px-2 py-3 italic">
            {search ? 'No matches' : 'No agents yet'}
          </div>
        )}
        {filtered.map(a => (
          <AgentRow
            key={a.id}
            agent={a}
            selected={selectedId === a.id}
            onClick={() => onSelect(a.id)}
          />
        ))}
      </div>
    </div>
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
        selected ? '' : 'bg-card hover:bg-card-2 shadow-[var(--shadow-card)]'
      }`}
      style={
        selected
          ? {
              background: `linear-gradient(120deg, color-mix(in srgb, ${c} 10%, transparent), transparent 70%), var(--bg-card)`,
              boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${c} 45%, transparent), 0 6px 22px -10px color-mix(in srgb, ${c} 32%, transparent)`,
            }
          : undefined
      }
    >
      {selected && (
        <div
          aria-hidden
          className="absolute left-0 top-0 bottom-0 w-[3px]"
          style={{ background: c }}
        />
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
