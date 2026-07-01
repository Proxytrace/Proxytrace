import { useState } from 'react';
import { Trans, Plural, useLingui } from '@lingui/react/macro';
import type { AgentListItemDto } from '../../api/models';
import { agentColor } from '../../lib/colors';
import { selectionRowStyle, selectionBarStyle, SELECTION_ROW_INACTIVE } from '../../lib/selectionRow';
import { cn } from '../../lib/cn';
import { fmtRelative } from '../../lib/format';
import { ListRail } from '../../components/ui/ListRail';
import { RowButton } from '../../components/ui/RowButton';
import { EmptyState } from '../../components/ui/EmptyState';
import { SwitchPill } from '../../components/ui/SwitchPill';

interface Props {
  agents: AgentListItemDto[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isLoading: boolean;
  showSystem: boolean;
  onToggleSystem?: () => void;
}

export function AgentList({ agents, selectedId, onSelect, isLoading, showSystem, onToggleSystem }: Props) {
  const { t } = useLingui();
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
      // eslint-disable-next-line lingui/no-unlocalized-strings -- test id, not UI copy
      listTestId="agent-list"
      title={t`Agents`}
      count={agents.length}
      search={{ value: search, onChange: setSearch, placeholder: t`Search agents…` }}
      filter={onToggleSystem ? (
        <SwitchPill
          checked={showSystem}
          onChange={onToggleSystem}
          title={showSystem ? t`Hide system agents` : t`Show system agents`}
          label={<Trans>System Agents</Trans>}
        />
      ) : undefined}
      loading={isLoading}
      isEmpty={filtered.length === 0}
      empty={<EmptyState title={search ? t`No matches` : t`No agents yet`} description={search ? t`Clear the search to see all agents.` : undefined} />}
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
      className={cn(
        'rounded-lg relative overflow-hidden transition-[box-shadow,background-color] duration-150 px-3 py-2.5 pl-3.5',
        !selected && SELECTION_ROW_INACTIVE,
      )}
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
      <div className="flex items-center gap-2 mt-1.5 text-caption text-muted pl-10">
        <span className="truncate">{agent.projectName}</span>
        <span aria-hidden>·</span>
        <span className="shrink-0"><Plural value={agent.toolCount} one="# tool" other="# tools" /></span>
        <span className="ml-auto shrink-0 font-mono">{agent.lastUsedAt ? fmtRelative(agent.lastUsedAt) : <Trans>never</Trans>}</span>
      </div>
    </RowButton>
  );
}
