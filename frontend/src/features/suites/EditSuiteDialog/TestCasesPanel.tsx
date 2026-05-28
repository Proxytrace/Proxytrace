import { useState } from 'react';
import type { AgentCallDto, TestCaseDto } from '../../../api/models';
import { FilterTabs } from '../../../components/ui/FilterTabs';
import { SearchIcon } from '../../../components/icons';
import { useSuiteAvailableTraces } from '../hooks/useSuiteAvailableTraces';
import { lastUserSnippet } from '../suitesMeta';
import { CurrentCasesList } from './CurrentCasesList';
import { AddTracesList } from './AddTracesList';

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

  const { data: tracesData, isLoading: tracesLoading } = useSuiteAvailableTraces(agentId, sub === 'add');
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
