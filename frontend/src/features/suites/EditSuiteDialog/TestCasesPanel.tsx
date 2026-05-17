import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AgentCallDto, TestCaseDto } from '../../../api/models';
import { agentCallsApi } from '../../../api/agent-calls';
import { QUERY_KEYS } from '../../../api/query-keys';
import { FilterTabs } from '../../../components/ui/FilterTabs';
import { ColoredBadge } from '../../../components/ui/ColoredBadge';
import { EmptyState } from '../../../components/ui/EmptyState';
import { SearchIcon, XIcon, PlusIcon } from '../../../components/icons';
import { fmtRelative, fmtTokens } from '../../../lib/format';
import { modelColor } from '../../../lib/colors';

function lastUserSnippet(msgs: { role: string; content: string }[]): string {
  const last = [...msgs].reverse().find(m => m.role === 'user');
  return (last?.content ?? msgs[msgs.length - 1]?.content ?? '').replace(/\s+/g, ' ').trim();
}

interface Props {
  agentId: string;
  cases: TestCaseDto[];
  pendingAddTraces: AgentCallDto[];
  pendingRemoveCaseIds: Set<string>;
  pendingAddTraceIds: Set<string>;
  selectedCaseId: string | null;
  selectedTraceId: string | null;
  onSelectCase: (id: string) => void;
  onSelectTrace: (id: string) => void;
  onToggleRemove: (id: string) => void;
  onToggleAddTrace: (id: string) => void;
}

export function TestCasesPanel({
  agentId,
  cases,
  pendingAddTraces,
  pendingRemoveCaseIds,
  pendingAddTraceIds,
  selectedCaseId,
  selectedTraceId,
  onSelectCase,
  onSelectTrace,
  onToggleRemove,
  onToggleAddTrace,
}: Props) {
  const [sub, setSub] = useState<'current' | 'add'>('current');
  const [search, setSearch] = useState('');

  const { data: tracesData, isLoading: tracesLoading } = useQuery({
    queryKey: QUERY_KEYS.agentCallsForSuiteEdit(agentId),
    queryFn: () => agentCallsApi.list({ agentId, pageSize: 50 }),
    enabled: sub === 'add',
  });

  const availableTraces = tracesData?.items ?? [];

  const q = search.trim().toLowerCase();
  const filteredCases = q
    ? cases.filter(tc => lastUserSnippet(tc.input).toLowerCase().includes(q))
    : cases;
  const filteredTraces = q
    ? availableTraces.filter(t => {
        const snip = (t.request.find(m => m.role === 'user')?.content ?? '').toLowerCase();
        return snip.includes(q) || t.model.toLowerCase().includes(q);
      })
    : availableTraces;

  return (
    <div className="flex flex-col gap-3 min-h-0 h-full">
      <div className="flex items-center gap-2">
        <FilterTabs
          options={[
            { label: 'Current', value: 'current', count: cases.length },
            { label: 'Add from traces', value: 'add', count: pendingAddTraces.length || undefined },
          ]}
          value={sub}
          onChange={(v) => setSub(v as 'current' | 'add')}
        />
      </div>

      <label className="flex items-center gap-2 px-3 rounded-[9px] bg-card-2 border border-border focus-within:border-[var(--accent-primary)] transition-colors cursor-text">
        <SearchIcon size={13} />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={sub === 'current' ? 'Search cases…' : 'Search traces…'}
          className="flex-1 min-w-0 bg-transparent border-0 py-[8px] text-[13px] outline-none text-primary placeholder:text-muted"
        />
        {search && (
          <button type="button" onClick={() => setSearch('')} className="text-[11px] text-muted hover:text-primary cursor-pointer bg-transparent border-0">clear</button>
        )}
      </label>

      <div className="flex-1 min-h-0 overflow-y-auto rounded-[12px] border border-border bg-card">
        {sub === 'current' && (
          <CurrentCasesList
            cases={filteredCases}
            pendingRemoveCaseIds={pendingRemoveCaseIds}
            selectedCaseId={selectedCaseId}
            onSelectCase={onSelectCase}
            onToggleRemove={onToggleRemove}
            empty={cases.length === 0}
            searched={!!q}
          />
        )}
        {sub === 'add' && (
          <AddTracesList
            traces={filteredTraces}
            loading={tracesLoading}
            pendingAddTraceIds={pendingAddTraceIds}
            selectedTraceId={selectedTraceId}
            onSelectTrace={onSelectTrace}
            onToggleAdd={onToggleAddTrace}
            empty={availableTraces.length === 0}
            searched={!!q}
          />
        )}
      </div>
    </div>
  );
}

function CurrentCasesList({
  cases, pendingRemoveCaseIds, selectedCaseId, onSelectCase, onToggleRemove, empty, searched,
}: {
  cases: TestCaseDto[];
  pendingRemoveCaseIds: Set<string>;
  selectedCaseId: string | null;
  onSelectCase: (id: string) => void;
  onToggleRemove: (id: string) => void;
  empty: boolean;
  searched: boolean;
}) {
  if (empty) {
    return <EmptyState title="No test cases" description="Switch to Add from traces to seed this suite." />;
  }
  if (cases.length === 0 && searched) {
    return <EmptyState title="No matches" description="Clear the search to see all cases." />;
  }
  return (
    <ul className="flex flex-col">
      {cases.map(tc => {
        const removing = pendingRemoveCaseIds.has(tc.id);
        const selected = selectedCaseId === tc.id;
        const snippet = lastUserSnippet(tc.input).slice(0, 120);
        return (
          <li
            key={tc.id}
            onClick={() => onSelectCase(tc.id)}
            className="cursor-pointer transition-colors duration-100"
            style={{
              padding: '10px 12px',
              borderLeft: `3px solid ${selected ? 'var(--accent-primary)' : 'transparent'}`,
              background: selected ? 'var(--accent-subtle)' : 'transparent',
              borderBottom: '1px solid var(--hairline)',
              opacity: removing ? 0.55 : 1,
            }}
          >
            <div className="flex items-center gap-2">
              <ColoredBadge color="var(--teal)" label={`${tc.input.length} msg`} size="sm" />
              <span
                className={`text-[12.5px] truncate min-w-0 flex-1 ${removing ? 'line-through text-muted' : 'text-primary'}`}
              >
                {snippet || <span className="text-muted italic">No user message</span>}
              </span>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onToggleRemove(tc.id); }}
                className={removing ? 'text-[11px] text-accent font-semibold cursor-pointer bg-transparent border-0 shrink-0' : 'btn-icon btn-icon-danger shrink-0'}
                title={removing ? 'Undo remove' : 'Remove'}
              >
                {removing ? 'Undo' : <XIcon size={12} />}
              </button>
            </div>
            {removing && (
              <div className="mt-[3px] text-[10.5px] text-warn font-semibold uppercase tracking-[0.08em]">Pending removal</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function AddTracesList({
  traces, loading, pendingAddTraceIds, selectedTraceId, onSelectTrace, onToggleAdd, empty, searched,
}: {
  traces: AgentCallDto[];
  loading: boolean;
  pendingAddTraceIds: Set<string>;
  selectedTraceId: string | null;
  onSelectTrace: (id: string) => void;
  onToggleAdd: (id: string) => void;
  empty: boolean;
  searched: boolean;
}) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2 p-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[58px] rounded-[9px] bg-card-2 animate-pulse" />
        ))}
      </div>
    );
  }
  if (empty) {
    return <EmptyState title="No traces" description="No agent calls were captured for this agent yet." />;
  }
  if (traces.length === 0 && searched) {
    return <EmptyState title="No matches" description="Clear the search to see all traces." />;
  }
  return (
    <ul className="flex flex-col">
      {traces.map(t => {
        const staged = pendingAddTraceIds.has(t.id);
        const selected = selectedTraceId === t.id;
        const lastMsg = t.request.find(m => m.role === 'user');
        const snippet = (lastMsg?.content ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
        return (
          <li
            key={t.id}
            onClick={() => onSelectTrace(t.id)}
            className="cursor-pointer transition-colors duration-100"
            style={{
              padding: '10px 12px',
              borderLeft: `3px solid ${staged ? 'var(--accent-primary)' : 'transparent'}`,
              background: staged ? 'var(--accent-subtle)' : selected ? 'rgba(255,255,255,0.025)' : 'transparent',
              borderBottom: '1px solid var(--hairline)',
            }}
          >
            <div className="flex items-center gap-2">
              <ColoredBadge color={modelColor(t.model)} label={t.model} dot size="sm" />
              <span className="text-[11px] font-mono text-muted shrink-0">{fmtRelative(t.createdAt)}</span>
              <span className="text-[11px] font-mono text-secondary shrink-0">{fmtTokens(t.inputTokens)}→{fmtTokens(t.outputTokens)}</span>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onToggleAdd(t.id); }}
                className={`ml-auto inline-flex items-center gap-1 px-2 py-[3px] rounded-[6px] text-[11px] font-semibold cursor-pointer border transition-colors shrink-0 ${
                  staged
                    ? 'bg-[var(--accent-subtle)] border-[var(--accent-primary)] text-accent'
                    : 'bg-card-2 border-border text-secondary hover:text-primary'
                }`}
              >
                {staged ? <><XIcon size={10} /> Staged</> : <><PlusIcon size={10} /> Add</>}
              </button>
            </div>
            <div className="mt-[5px] text-[12px] text-secondary truncate min-w-0">
              {snippet ? snippet : <span className="text-muted italic">No user message</span>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
