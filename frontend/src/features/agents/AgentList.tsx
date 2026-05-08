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
          className="w-full bg-card rounded-xl pl-[34px] pr-[34px] py-[8px] text-[12.5px] text-primary placeholder:text-muted outline-none border border-transparent focus:border-[var(--border-hairline)] transition-colors"
          style={{ boxShadow: 'var(--shadow-card)' }}
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

      <div className="flex-1 min-h-0 overflow-y-auto pr-[2px] flex flex-col gap-[6px]">
        {isLoading && (
          <div className="text-[12px] text-muted px-2 py-3">Loading…</div>
        )}
        {!isLoading && filtered.length === 0 && (
          <div className="text-[12px] text-muted px-2 py-3 italic">
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
      className="text-left rounded-xl relative overflow-hidden cursor-pointer transition-shadow duration-150"
      style={{
        background: selected ? `linear-gradient(120deg, ${c}1a, transparent 70%), var(--bg-card)` : 'var(--bg-card)',
        boxShadow: selected ? `0 0 0 1.5px ${c}88, 0 8px 28px -10px ${c}55` : 'var(--shadow-card)',
        border: 'none',
        padding: '10px 12px 10px 14px',
      }}
    >
      {selected && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: 0, top: 0, bottom: 0,
            width: 3,
            background: c,
          }}
        />
      )}
      <div className="flex items-center gap-[10px] min-w-0">
        <div
          className="flex items-center justify-center shrink-0"
          style={{
            width: 30, height: 30, borderRadius: 9,
            background: `${c}1e`, border: `1px solid ${c}33`,
          }}
        >
          <span className="text-[13px] font-bold font-mono" style={{ color: c }}>{initial}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] font-semibold text-primary truncate">{agent.name}</div>
          <div className="text-[10.5px] text-muted truncate font-mono">{agent.endpointName}</div>
        </div>
      </div>
      <div className="flex items-center gap-[10px] mt-[6px] text-[10.5px] text-muted pl-[40px]">
        <span className="truncate">{agent.projectName}</span>
        <span>·</span>
        <span className="shrink-0">{agent.tools.length} tool{agent.tools.length !== 1 ? 's' : ''}</span>
        <span className="ml-auto shrink-0">{agent.lastUsedAt ? fmtRelative(agent.lastUsedAt) : 'never'}</span>
      </div>
    </button>
  );
}
