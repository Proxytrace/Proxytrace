import { useMemo, useState } from 'react';
import type { AgentDto } from '../../api/models';
import { SearchIcon, XIcon } from '../../components/icons';
import { agentColor } from '../../lib/colors';
import { fmtRelative } from '../../lib/format';

interface Props {
  agents: AgentDto[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isLoading: boolean;
}

export function AgentList({ agents, selectedId, onSelect, isLoading }: Props) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter(a =>
      a.name.toLowerCase().includes(q)
      || a.projectName.toLowerCase().includes(q)
      || a.endpointName.toLowerCase().includes(q),
    );
  }, [agents, search]);

  return (
    <div className="flex flex-col gap-3 min-h-0">
      <div className="relative">
        <SearchIcon
          size={13}
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted"
        />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search agents…"
          className="w-full bg-card rounded-md pl-[30px] pr-[30px] py-[7px] text-body text-primary placeholder:text-muted outline-none border border-border-subtle focus:border-border transition-colors shadow-[var(--shadow-card)]"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 btn-icon"
            aria-label="Clear search"
          >
            <XIcon size={12} />
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-[2px] flex flex-col gap-1.5">
        {isLoading && (
          <div className="text-body text-muted px-2 py-3">Loading…</div>
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

function AgentRow({ agent, selected, onClick }: { agent: AgentDto; selected: boolean; onClick: () => void }) {
  const c = agentColor(agent.id);
  const initial = agent.name[0]?.toUpperCase() ?? '?';

  return (
    <button
      onClick={onClick}
      className={`text-left rounded-lg relative overflow-hidden cursor-pointer transition-[box-shadow,background-color] duration-150 px-3 py-2.5 pl-[14px] border-0 ${
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
        <span className="shrink-0">{agent.tools.length} tool{agent.tools.length !== 1 ? 's' : ''}</span>
        <span className="ml-auto shrink-0 font-mono">{agent.lastUsedAt ? fmtRelative(agent.lastUsedAt) : 'never'}</span>
      </div>
    </button>
  );
}
