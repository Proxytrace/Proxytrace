import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchApi, type SearchHit } from '../../api/search';
import { evaluatorTestBenchApi } from '../../api/evaluator-testbench';
import { QUERY_KEYS } from '../../api/query-keys';

const RECENT_COUNT = 3;

interface Props {
  evaluatorId: string;
  projectId: string | null;
  selectedLabel: string | null;
  onSelect: (hit: SearchHit) => void;
}

export function TestResultPicker({ evaluatorId, projectId, selectedLabel, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 200);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const { data, isFetching } = useQuery({
    queryKey: QUERY_KEYS.search(projectId ?? '', debounced),
    queryFn: () => searchApi.search(projectId!, debounced),
    enabled: open && projectId != null && debounced.length > 0,
    staleTime: 15_000,
  });

  const recentQuery = useQuery({
    queryKey: QUERY_KEYS.evaluatorTestBenchRecent(evaluatorId, RECENT_COUNT),
    queryFn: () => evaluatorTestBenchApi.recent(evaluatorId, RECENT_COUNT),
    enabled: open && debounced.length === 0,
    staleTime: 15_000,
  });

  const hits = useMemo(() => {
    const all = data?.hits ?? [];
    return all.filter(h => h.kind === 'testCase').slice(0, 30);
  }, [data]);

  const recentHits = useMemo<SearchHit[]>(
    () => (recentQuery.data ?? []).map(r => ({
      kind: 'testCase',
      entityId: r.testCaseId,
      title: r.label,
      snippet: '',
      score: 0,
      metadata: {},
    })),
    [recentQuery.data],
  );

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-card text-left text-[12.5px] text-primary cursor-pointer transition-colors hover:bg-card-2"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <SearchIcon />
        <span className={`flex-1 truncate ${selectedLabel ? 'text-primary' : 'text-muted'}`}>
          {selectedLabel ?? 'Search a past test result…'}
        </span>
        <span className="text-muted text-[10px]">▾</span>
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 rounded-lg border border-border bg-card-2 shadow-[var(--shadow-float)] overflow-hidden"
          role="listbox"
        >
          <div className="p-2 border-b border-hairline">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Type to search test cases…"
              className="w-full px-2.5 py-1.5 rounded-md border border-border bg-card text-[12.5px] text-primary outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div className="max-h-[320px] overflow-y-auto">
            {projectId == null ? (
              <Empty>Pick a project first.</Empty>
            ) : debounced.length === 0 ? (
              recentQuery.isLoading ? (
                <Empty>Loading recent…</Empty>
              ) : recentHits.length === 0 ? (
                <Empty>No recent test results.</Empty>
              ) : (
                <>
                  <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                    Recent
                  </div>
                  {recentHits.map(h => (
                    <button
                      key={`${h.kind}:${h.entityId}`}
                      type="button"
                      onClick={() => { onSelect(h); setOpen(false); setQuery(''); }}
                      className="w-full text-left px-3 py-2 hover:bg-card cursor-pointer border-b border-hairline last:border-b-0"
                    >
                      <div className="text-[12.5px] text-primary truncate">{h.title}</div>
                    </button>
                  ))}
                </>
              )
            ) : isFetching ? (
              <Empty>Searching…</Empty>
            ) : hits.length === 0 ? (
              <Empty>No test cases match.</Empty>
            ) : (
              hits.map(h => (
                <button
                  key={`${h.kind}:${h.entityId}`}
                  type="button"
                  onClick={() => { onSelect(h); setOpen(false); setQuery(''); }}
                  className="w-full text-left px-3 py-2 hover:bg-card cursor-pointer border-b border-hairline last:border-b-0"
                >
                  <div className="text-[12.5px] text-primary truncate">{h.title}</div>
                  {h.snippet && (
                    <div className="text-[11px] text-muted truncate mt-0.5">{h.snippet}</div>
                  )}
                  {(h.metadata?.suiteName || h.metadata?.agentName) && (
                    <div className="text-[10px] text-muted font-mono tracking-[0.04em] mt-1">
                      {h.metadata?.suiteName && <span>suite: {h.metadata.suiteName}</span>}
                      {h.metadata?.suiteName && h.metadata?.agentName && <span> · </span>}
                      {h.metadata?.agentName && <span>agent: {h.metadata.agentName}</span>}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-3 py-4 text-center text-[12px] text-muted">{children}</div>;
}

function SearchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted shrink-0" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}
