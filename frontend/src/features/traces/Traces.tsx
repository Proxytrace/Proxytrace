import { useState, useCallback, useMemo } from 'react';
import { Pagination } from '../../components/ui/Pagination';
import { FilterDropdown } from '../../components/ui/FilterDropdown';
import { TraceDetail } from './TraceDetail';
import type { AgentCallDto } from '../../api/models';
import { buildRows, rangeFrom, nowMs } from './tracesMeta';
import { PAGE_SIZE, PAGE_SIZE_OPTIONS } from './hooks/useTraceQueries';
import { useTraceQueries } from './hooks/useTraceQueries';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { useFocusTrace } from './hooks/useFocusTrace';
import { useScrollToTrace } from './hooks/useScrollToTrace';
import { useTraceSseStream } from './hooks/useTraceSseStream';
import { AgentFilterCards } from './components/AgentFilterCards';
import { TraceToolbar } from './components/TraceToolbar';
import { TraceTable } from './components/TraceTable';
import { TraceTimeline } from '../../components/charts/TraceTimeline';
import { useTraceHistogram } from './hooks/useTraceHistogram';
import { useAutoDefaultRange } from './hooks/useAutoDefaultRange';
import useCurrentProject from '../../hooks/useCurrentProject';
import { useDebounce } from '../../hooks/useDebounce';

export default function Traces() {
  const [page, setPage] = useState(1);
  const [storedPageSize, setStoredPageSize] = useLocalStorageState<number>('traces.pageSize', PAGE_SIZE);
  // Guard against a stale/garbage stored value — only accept a known option.
  const pageSize = (PAGE_SIZE_OPTIONS as readonly number[]).includes(storedPageSize) ? storedPageSize : PAGE_SIZE;
  const [range, setRange] = useState('24h');
  const [agentFilter, setAgentFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showSystem, setShowSystem] = useState(false);
  const [selectedTrace, setSelectedTrace] = useState<AgentCallDto | null>(null);
  const [expandedConvs, setExpandedConvs] = useState<Set<string>>(new Set());
  const [pendingScrollId, setPendingScrollId] = useState<string | null>(null);
  const [brush, setBrush] = useState<{ from: number; to: number } | null>(null);

  const { currentProjectId } = useCurrentProject();
  const debouncedSearch = useDebounce(search, 200);
  // Memoize so `from` is stable across renders; recomputing `Date.now()` each
  // render would churn the queryKeys below and cause an infinite refetch loop.
  const from = useMemo(() => rangeFrom(range), [range]);
  // The timeline's right edge re-anchors to "now" only when the preset changes.
  const windowFrom = useMemo(() => (from ? new Date(from).getTime() : null), [from]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally re-anchored on preset change
  const windowTo = useMemo(() => nowMs(), [from]);

  // On first load, auto-pick the smallest preset that still contains data.
  useAutoDefaultRange(currentProjectId !== null, currentProjectId ?? undefined, setRange);

  // Brush narrows the table to a sub-range; otherwise the table uses the full preset window.
  const tableFrom = brush ? new Date(brush.from).toISOString() : from;
  const tableTo = brush ? new Date(brush.to).toISOString() : undefined;

  const { traces, total, isFetching, allAgents, agentBreakdown, p95 } = useTraceQueries({
    page,
    pageSize,
    range,
    agentFilter,
    debouncedSearch,
    showSystem,
    from: tableFrom,
    to: tableTo,
  });

  // Histogram spans the full preset window and respects every filter except the brush.
  const { buckets } = useTraceHistogram({ from, agentFilter, debouncedSearch, showSystem });

  // Only surface agents that actually have traces in the current range — an agent with a
  // zero count is noise on the Traces tab (it has nothing to show).
  const callCounts = useMemo(
    () => new Map(agentBreakdown.map(b => [b.agentId, b.callCount])),
    [agentBreakdown],
  );
  const visibleAgents = showSystem ? allAgents : allAgents.filter(a => !a.isSystemAgent);
  const agents = visibleAgents.filter(a => (callCounts.get(a.id) ?? 0) > 0);

  const rows = useMemo(() => buildRows(traces), [traces]);

  // Flat list of all individual traces for prev/next navigation in the drawer
  const flatTraces = rows.flatMap(r => r.type === 'flat' ? [r.trace] : r.turns);
  const selectedIdx = selectedTrace ? flatTraces.findIndex(t => t.id === selectedTrace.id) : -1;

  const handleExpandConversation = useCallback((conversationId: string) => {
    setExpandedConvs(prev => {
      const next = new Set(prev);
      next.add(conversationId);
      return next;
    });
  }, []);

  const handleFocusTrace = useCallback((trace: AgentCallDto) => {
    setSelectedTrace(trace);
    setPendingScrollId(trace.id);
    setRange('all');
    setBrush(null);
    setAgentFilter('');
    setSearch('');
    setShowSystem(true);
    setPage(1);
  }, []);

  useFocusTrace({
    onTrace: handleFocusTrace,
    onExpandConversation: handleExpandConversation,
  });

  useScrollToTrace(
    pendingScrollId,
    useCallback(() => setPendingScrollId(null), []),
    rows,
    expandedConvs,
  );

  useTraceSseStream();

  function toggleConv(id: string) {
    setExpandedConvs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleAgentFilterChange(id: string) {
    setAgentFilter(id);
    setPage(1);
  }

  function handleRangeChange(key: string) {
    setRange(key);
    setBrush(null);
    setPage(1);
  }

  function handleSearchChange(v: string) {
    setSearch(v);
    setPage(1);
  }

  function handleShowSystemChange(v: boolean) {
    setShowSystem(v);
    setPage(1);
  }

  function handlePageSizeChange(v: number) {
    setStoredPageSize(v);
    setPage(1);
  }

  return (
    <div className="w-full min-w-0 h-full min-h-0 flex flex-col gap-[14px]">
      <AgentFilterCards
        agents={agents}
        agentBreakdown={agentBreakdown}
        agentFilter={agentFilter}
        p95={p95}
        onFilterChange={handleAgentFilterChange}
      />

      <TraceToolbar
        search={search}
        range={range}
        agentFilter={agentFilter}
        showSystem={showSystem}
        agents={agents}
        onSearchChange={handleSearchChange}
        onRangeChange={handleRangeChange}
        onAgentFilterChange={handleAgentFilterChange}
        onShowSystemChange={handleShowSystemChange}
      />

      {buckets.length > 0 && (
        <TraceTimeline
          buckets={buckets}
          from={windowFrom ?? new Date(buckets[0].start).getTime()}
          to={windowTo}
          selection={brush}
          onSelect={range => { setBrush(range); setPage(1); }}
        />
      )}

      <TraceTable
        rows={rows}
        isFetching={isFetching}
        selectedId={selectedTrace?.id ?? null}
        expandedConvs={expandedConvs}
        onSelectTrace={setSelectedTrace}
        onToggleConv={toggleConv}
      />

      {total > 0 && (
        <div data-testid="trace-pagination" className="flex items-center justify-between gap-3 shrink-0">
          <FilterDropdown
            label="Per page:"
            value={String(pageSize)}
            active
            direction="up"
            options={PAGE_SIZE_OPTIONS.map(n => ({ key: String(n), label: String(n) }))}
            onChange={key => handlePageSizeChange(Number(key))}
            width={110}
          />
          <Pagination page={page} total={total} pageSize={pageSize} onChange={setPage} />
          <span className="text-caption text-muted whitespace-nowrap">{total.toLocaleString()} total</span>
        </div>
      )}

      {selectedTrace && (
        <TraceDetail
          trace={selectedTrace}
          onClose={() => setSelectedTrace(null)}
          onPrev={selectedIdx > 0 ? () => setSelectedTrace(flatTraces[selectedIdx - 1]) : undefined}
          onNext={selectedIdx < flatTraces.length - 1 ? () => setSelectedTrace(flatTraces[selectedIdx + 1]) : undefined}
        />
      )}
    </div>
  );
}
