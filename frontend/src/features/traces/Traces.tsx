import { useState, useCallback, useMemo } from 'react';
import { Pagination } from '../../components/ui/Pagination';
import { TraceDetail } from './TraceDetail';
import type { AgentCallDto } from '../../api/models';
import { buildRows, rangeFrom } from './tracesMeta';
import { PAGE_SIZE } from './hooks/useTraceQueries';
import { useTraceQueries } from './hooks/useTraceQueries';
import { useFocusTrace } from './hooks/useFocusTrace';
import { useScrollToTrace } from './hooks/useScrollToTrace';
import { useTraceSseStream } from './hooks/useTraceSseStream';
import { AgentFilterCards } from './components/AgentFilterCards';
import { TraceToolbar } from './components/TraceToolbar';
import { TraceTable } from './components/TraceTable';
import { useDebounce } from './hooks/useDebounce';

export default function Traces() {
  const [page, setPage] = useState(1);
  const [range, setRange] = useState('24h');
  const [agentFilter, setAgentFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showSystem, setShowSystem] = useState(false);
  const [selectedTrace, setSelectedTrace] = useState<AgentCallDto | null>(null);
  const [expandedConvs, setExpandedConvs] = useState<Set<string>>(new Set());
  const [pendingScrollId, setPendingScrollId] = useState<string | null>(null);

  const debouncedSearch = useDebounce(search, 200);
  const from = useMemo(() => rangeFrom(range), [range]);

  const { traces, total, isFetching, allAgents, agentBreakdown, p95 } = useTraceQueries({
    page,
    range,
    agentFilter,
    debouncedSearch,
    showSystem,
    from,
  });

  const agents = useMemo(
    () => showSystem ? allAgents : allAgents.filter(a => !a.isSystemAgent),
    [allAgents, showSystem],
  );

  const rows = useMemo(() => buildRows(traces), [traces]);

  // Flat list of all individual traces for prev/next navigation in the drawer
  const flatTraces = useMemo(
    () => rows.flatMap(r => r.type === 'flat' ? [r.trace] : r.turns),
    [rows],
  );
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

      <TraceTable
        rows={rows}
        isFetching={isFetching}
        selectedId={selectedTrace?.id ?? null}
        expandedConvs={expandedConvs}
        onSelectTrace={setSelectedTrace}
        onToggleConv={toggleConv}
      />

      {total > PAGE_SIZE && (
        <div className="flex justify-center shrink-0">
          <Pagination page={page} total={total} pageSize={PAGE_SIZE} onChange={setPage} />
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
