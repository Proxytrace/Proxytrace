import { useState, useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { agentCallsApi } from '../../api/agent-calls';
import { agentsApi } from '../../api/agents';
import { statisticsApi } from '../../api/statistics';
import { QUERY_KEYS } from '../../api/query-keys';
import { useCurrentProject } from '../../contexts/ProjectContext';
import { SearchIcon } from '../../components/icons';
import type { AgentCallDto } from '../../api/models';
import { Pagination } from '../../components/ui/Pagination';
import { Pill } from '../../components/ui/Pill';
import { StatusDot } from '../../components/ui/StatusDot';
import { useTraceStream } from '../../api/event-stream';
import { agentColor, modelColor } from '../../lib/colors';
import { fmtLatency, fmtRelative, fmtTokens } from '../../lib/format';
import { TraceDetail } from './TraceDetail';
import { FilterDropdown } from '../../components/ui/FilterDropdown';
import { DEFAULT_PAGE_SIZE } from '../../lib/constants';

const PAGE_SIZE = DEFAULT_PAGE_SIZE;
const RANGES = [
  { key: '1h', label: '1h' }, { key: '24h', label: '24h' },
  { key: '7d', label: '7d' }, { key: '30d', label: '30d' }, { key: 'all', label: 'All' },
];

function rangeFrom(key: string): string | undefined {
  const now = Date.now();
  if (key === '1h') return new Date(now - 3600_000).toISOString();
  if (key === '24h') return new Date(now - 86400_000).toISOString();
  if (key === '7d') return new Date(now - 7 * 86400_000).toISOString();
  if (key === '30d') return new Date(now - 30 * 86400_000).toISOString();
  return undefined;
}

function LatencyBar({ ms }: { ms: number }) {
  const pct = Math.min(100, ms / 60);
  const color = ms > 3000 ? 'var(--warn)' : 'var(--accent-primary)';
  return (
    <span className="flex-1 max-w-[60px] h-[3px] rounded-full overflow-hidden inline-block align-middle" style={{ background: 'rgba(255,255,255,0.05)' }}>
      <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </span>
  );
}

// ── Row types ────────────────────────────────────────────────────────────────

type ConversationGroup = { type: 'conversation'; conversationId: string; turns: AgentCallDto[] };
type FlatTrace = { type: 'flat'; trace: AgentCallDto };
type TraceRow = ConversationGroup | FlatTrace;

function buildRows(traces: AgentCallDto[]): TraceRow[] {
  const groups = new Map<string, AgentCallDto[]>();
  for (const t of traces) {
    if (t.conversationId) {
      const g = groups.get(t.conversationId) ?? [];
      g.push(t);
      groups.set(t.conversationId, g);
    }
  }
  const multi = new Set(
    [...groups.entries()].filter(([, v]) => v.length > 1).map(([k]) => k)
  );

  const rows: TraceRow[] = [];
  const emitted = new Set<string>();
  for (const t of traces) {
    if (t.conversationId && multi.has(t.conversationId)) {
      if (!emitted.has(t.conversationId)) {
        emitted.add(t.conversationId);
        rows.push({ type: 'conversation', conversationId: t.conversationId, turns: groups.get(t.conversationId)! });
      }
    } else {
      rows.push({ type: 'flat', trace: t });
    }
  }
  return rows;
}

// ── Column widths (shared between header, flat rows, and child rows) ──────────

const COL_WIDTHS = ['180px', '1fr', '140px', '72px', '70px', '130px', '120px', '80px'];
const GRID = `${COL_WIDTHS.join(' ')}`;

// ── Shared cell renderers ─────────────────────────────────────────────────────

function TraceIdCell({ trace }: { trace: AgentCallDto }) {
  const c = trace.agentId ? agentColor(trace.agentId) : modelColor(trace.model);
  return (
    <span className="flex items-center gap-2 min-w-0">
      <span className="w-[3px] h-[18px] rounded-[2px] shrink-0" style={{ background: c }} />
      <span className="mono text-primary text-[11px]">{trace.id.slice(0, 8)}…{trace.id.slice(-4)}</span>
    </span>
  );
}

function TokenCell({ trace }: { trace: AgentCallDto }) {
  return (
    <span className="mono text-[11px]">
      <span className="text-primary">{fmtTokens(trace.inputTokens + trace.outputTokens)}</span>
      <span className="text-muted ml-[5px] text-[10px]">{fmtTokens(trace.inputTokens)}/{fmtTokens(trace.outputTokens)}</span>
    </span>
  );
}

function ToolsCell({ count }: { count: number }) {
  return count > 0
    ? <span className="mono text-[11px] text-primary">{count}</span>
    : <span className="text-muted text-[11px]">—</span>;
}

function LatencyCell({ trace }: { trace: AgentCallDto }) {
  return (
    <span className="flex items-center gap-[7px]">
      <span className={`mono text-[11px] min-w-[40px] shrink-0 ${trace.durationMs > 3000 ? 'text-warn' : 'text-secondary'}`}>{fmtLatency(trace.durationMs)}</span>
      <LatencyBar ms={trace.durationMs} />
    </span>
  );
}

// ── Flat trace row ────────────────────────────────────────────────────────────

function FlatTraceRow({ trace, selected, onClick }: { trace: AgentCallDto; selected: boolean; onClick: () => void }) {
  return (
    <div
      role="row"
      data-trace-id={trace.id}
      onClick={onClick}
      className={`grid items-center px-4 py-[10px] cursor-pointer transition-colors duration-[100ms] border-b border-b-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.025)] ${selected ? 'bg-[rgba(255,255,255,0.04)]' : ''}`}
      style={{ gridTemplateColumns: GRID, minHeight: 44 }}
    >
      <TraceIdCell trace={trace} />
      <span className="text-[12px] text-secondary overflow-hidden text-ellipsis whitespace-nowrap pr-2">
        {trace.agentName ?? <span className="text-muted">—</span>}
      </span>
      <span className="overflow-hidden"><Pill label={trace.model} color={modelColor(trace.model)} size="sm" /></span>
      <StatusDot httpStatus={trace.httpStatus} />
      <ToolsCell count={trace.response.toolRequests.length} />
      <TokenCell trace={trace} />
      <LatencyCell trace={trace} />
      <span className="text-muted text-[11px] whitespace-nowrap text-right">{fmtRelative(trace.createdAt)}</span>
    </div>
  );
}

// ── Conversation group row + children ─────────────────────────────────────────

function ConversationGroupRow({
  group,
  expanded,
  onToggle,
  selectedId,
  onSelectTrace,
}: {
  group: ConversationGroup;
  expanded: boolean;
  onToggle: () => void;
  selectedId: string | null;
  onSelectTrace: (trace: AgentCallDto) => void;
}) {
  const { turns, conversationId } = group;
  const totalTokens = turns.reduce((n, t) => n + t.inputTokens + t.outputTokens, 0);
  const totalMs = turns.reduce((n, t) => n + t.durationMs, 0);
  const totalTools = turns.reduce((n, t) => n + t.response.toolRequests.length, 0);
  const agentName = turns[0].agentName;
  const model = turns[0].model;
  const c = turns[0].agentId ? agentColor(turns[0].agentId) : agentColor(conversationId);

  return (
    <>
      {/* Header row */}
      <div
        role="row"
        onClick={onToggle}
        className="grid items-center px-4 py-[10px] cursor-pointer transition-colors duration-[100ms] border-b border-b-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.025)]"
        style={{ gridTemplateColumns: GRID, minHeight: 44, background: 'rgba(255,255,255,0.015)' }}
      >
        {/* ID column: aligned with flat rows, chevron after the turns badge */}
        <span className="flex items-center gap-2 min-w-0">
          <span className="w-[3px] h-[18px] rounded-[2px] shrink-0" style={{ background: c }} />
          <span className="mono text-[11px] text-accent-primary">{conversationId.slice(0, 8)}…</span>
          <span className="inline-flex items-center gap-[3px] text-[10px] font-semibold px-[5px] py-[1px] rounded-full" style={{ background: `color-mix(in srgb, ${c} 14%, transparent)`, color: c }}>
            {turns.length} turns
            <svg
              width="8" height="8" viewBox="0 0 8 8" fill="none"
              className="shrink-0 transition-transform duration-[150ms]"
              style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
            >
              <path d="M2.5 1.5L5.5 4L2.5 6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
        </span>

        {/* Agent */}
        <span className="text-[12px] text-secondary overflow-hidden text-ellipsis whitespace-nowrap pr-2">
          {agentName ?? <span className="text-muted">—</span>}
        </span>

        {/* Model */}
        <span className="overflow-hidden"><Pill label={model} color={modelColor(model)} size="sm" /></span>

        {/* Status — combined: show success if all OK, else warn/danger */}
        <span className="inline-flex items-center gap-[5px]">
          {turns.every(t => t.httpStatus >= 200 && t.httpStatus < 300)
            ? <><StatusDot httpStatus={200} showLabel={false} /><span className="mono text-[11px] text-success">2xx</span></>
            : <><StatusDot httpStatus={500} showLabel={false} /><span className="mono text-[11px] text-warn">mixed</span></>}
        </span>

        {/* Tools — summed */}
        <ToolsCell count={totalTools} />

        {/* Tokens — summed */}
        <span className="mono text-[11px]">
          <span className="text-primary">{fmtTokens(totalTokens)}</span>
          <span className="text-muted ml-[5px] text-[10px]">total</span>
        </span>

        {/* Latency — summed */}
        <span className="flex items-center gap-[7px]">
          <span className={`mono text-[11px] min-w-[40px] shrink-0 ${totalMs > 3000 ? 'text-warn' : 'text-secondary'}`}>{fmtLatency(totalMs)}</span>
          <LatencyBar ms={totalMs} />
        </span>

        {/* Time of most-recent turn */}
        <span className="text-muted text-[11px] whitespace-nowrap text-right">{fmtRelative(turns[0].createdAt)}</span>
      </div>

      {/* Child turn rows */}
      {expanded && turns.map((turn, i) => (
        <div
          key={turn.id}
          role="row"
          data-trace-id={turn.id}
          onClick={() => onSelectTrace(turn)}
          className={`grid items-center pl-8 pr-4 py-[10px] cursor-pointer transition-colors duration-[100ms] border-b border-b-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.025)] ${turn.id === selectedId ? 'bg-[rgba(255,255,255,0.04)]' : ''}`}
          style={{ gridTemplateColumns: GRID, minHeight: 44, borderLeft: `2px solid color-mix(in srgb, ${c} 38%, transparent)` }}
        >
          {/* ID column: turn label */}
          <span className="flex items-center gap-2 min-w-0">
            <span className="mono text-[10px] text-muted shrink-0">Turn {turns.length - i}</span>
            <span className="mono text-primary text-[11px]">{turn.id.slice(0, 8)}…{turn.id.slice(-4)}</span>
          </span>
          <span className="text-[12px] text-secondary overflow-hidden text-ellipsis whitespace-nowrap pr-2">
            {turn.agentName ?? <span className="text-muted">—</span>}
          </span>
          <span className="overflow-hidden"><Pill label={turn.model} color={modelColor(turn.model)} size="sm" /></span>
          <StatusDot httpStatus={turn.httpStatus} />
          <ToolsCell count={turn.response.toolRequests.length} />
          <TokenCell trace={turn} />
          <LatencyCell trace={turn} />
          <span className="text-muted text-[11px] whitespace-nowrap text-right">{fmtRelative(turn.createdAt)}</span>
        </div>
      ))}
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Traces() {
  const qc = useQueryClient();
  const { currentProjectId } = useCurrentProject();
  const projectId = currentProjectId ?? undefined;
  const enabled = currentProjectId !== null;
  const [page, setPage] = useState(1);
  const [range, setRange] = useState('24h');
  const [agentFilter, setAgentFilter] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showSystem, setShowSystem] = useState(false);
  const [selectedTrace, setSelectedTrace] = useState<AgentCallDto | null>(null);
  const [expandedConvs, setExpandedConvs] = useState<Set<string>>(new Set());
  const [pendingScrollId, setPendingScrollId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const focusId = searchParams.get('focus');

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 200);
    return () => clearTimeout(handle);
  }, [search]);

  useEffect(() => {
    if (!focusId) return;
    let cancelled = false;
    agentCallsApi.get(focusId).then(trace => {
      if (cancelled) return;
      setSelectedTrace(trace);
      setPendingScrollId(trace.id);
      setRange('all');
      setAgentFilter('');
      setSearch('');
      setShowSystem(true);
      setPage(1);
      if (trace.conversationId) {
        const cid = trace.conversationId;
        setExpandedConvs(prev => {
          const next = new Set(prev);
          next.add(cid);
          return next;
        });
      }
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.delete('focus');
        return next;
      }, { replace: true });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [focusId, setSearchParams]);

  const from = useMemo(() => rangeFrom(range), [range]);
  const trimmedSearch = debouncedSearch.trim();
  const filter = useMemo(() => ({
    page, pageSize: PAGE_SIZE,
    includeSystemAgents: showSystem,
    ...(projectId ? { projectId } : {}),
    ...(agentFilter ? { agentId: agentFilter } : {}),
    ...(from ? { from } : {}),
    ...(trimmedSearch.length >= 2 ? { q: trimmedSearch } : {}),
  }), [page, agentFilter, from, showSystem, projectId, trimmedSearch]);

  const { data, isFetching } = useQuery({
    queryKey: QUERY_KEYS.agentCalls(filter),
    queryFn: () => agentCallsApi.list(filter),
    placeholderData: keepPreviousData,
    enabled,
  });

  const { data: agentsData } = useQuery({
    queryKey: QUERY_KEYS.agents(projectId),
    queryFn: () => agentsApi.list({ projectId, pageSize: 200 }),
    enabled,
  });
  const { data: agentBreakdown = [] } = useQuery({
    queryKey: QUERY_KEYS.statisticsAgentBreakdown(from, projectId),
    queryFn: () => statisticsApi.agentBreakdown({ from, projectId }),
    enabled,
  });
  const { data: latencyStats = [] } = useQuery({
    queryKey: QUERY_KEYS.statisticsLatency(from, agentFilter || undefined, projectId),
    queryFn: () => statisticsApi.latency({ from, agentId: agentFilter || undefined, projectId }),
    enabled,
  });

  const traces = data?.items ?? [];
  const total = data?.total ?? 0;
  const allAgents = agentsData?.items ?? [];
  const agents = useMemo(
    () => showSystem ? allAgents : allAgents.filter(a => !a.isSystemAgent),
    [allAgents, showSystem],
  );
  const p95 = latencyStats[0]?.p95Ms ?? null;

  const rows = useMemo(() => buildRows(traces), [traces]);

  useEffect(() => {
    if (!pendingScrollId) return;
    const t = setTimeout(() => {
      const el = document.querySelector(`[data-trace-id="${pendingScrollId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setPendingScrollId(null);
      }
    }, 50);
    return () => clearTimeout(t);
  }, [pendingScrollId, rows, expandedConvs]);

  useTraceStream(useCallback(() => {
    qc.invalidateQueries({ queryKey: ['agent-calls'] });
    qc.invalidateQueries({ queryKey: ['statistics-agent-breakdown'] });
  }, [qc]));

  function toggleConv(id: string) {
    setExpandedConvs(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // Flat list of all individual traces for prev/next navigation in the drawer
  const flatTraces = useMemo(
    () => rows.flatMap(r => r.type === 'flat' ? [r.trace] : r.turns),
    [rows]
  );
  const selectedIdx = selectedTrace ? flatTraces.findIndex(t => t.id === selectedTrace.id) : -1;

  return (
    <div className="w-full min-w-0 flex flex-col gap-[14px]">

      {/* ── Agent filter cards ── */}
      {agents.length > 0 && (
        <div
          className="fade-up grid gap-2 p-1"
          style={{
            animationDelay: '40ms',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          }}
        >
          {agents.map(a => {
            const c = agentColor(a.id);
            const isActive = agentFilter === a.id;
            const callCount = agentBreakdown.find(b => b.agentId === a.id)?.callCount ?? 0;
            return (
              <button
                key={a.id}
                onClick={() => setAgentFilter(isActive ? '' : a.id)}
                className="text-left bg-card rounded-xl px-[14px] py-3 relative overflow-hidden transition-[box-shadow] duration-[150ms] border-none cursor-pointer"
                style={{ boxShadow: isActive ? `0 0 0 1.5px color-mix(in srgb, ${c} 53%, transparent), 0 4px 16px -6px color-mix(in srgb, ${c} 38%, transparent)` : 'var(--shadow-card)' }}
              >
                <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${c}, color-mix(in srgb, ${c} 28%, transparent))` }} />
                <div className="text-[11.5px] font-semibold mb-[6px] overflow-hidden text-ellipsis whitespace-nowrap pr-1">
                  {a.name}
                </div>
                <div className="flex items-baseline gap-[5px]">
                  <span className="text-[20px] font-bold tracking-[-0.02em]" style={{ color: isActive ? c : 'var(--text-primary)' }}>{callCount || '—'}</span>
                  <span className="text-[10.5px] text-muted">traces</span>
                </div>
              </button>
            );
          })}
          {p95 != null && (
            <div className="bg-card rounded-xl px-[14px] py-3 relative overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
              <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, var(--teal), transparent)' }} />
              <div className="text-[11.5px] font-semibold mb-[6px] text-muted">p95 Latency</div>
              <div className="flex items-baseline gap-[5px]">
                <span className="text-[20px] font-bold tracking-[-0.02em] font-mono text-teal">{fmtLatency(p95)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Search + filter chips ── */}
      <div className="fade-up relative z-20 flex items-center gap-[10px] flex-wrap" style={{ animationDelay: '80ms' }}>
        <span className={`inline-flex items-center gap-[5px] text-[11px] font-semibold px-2 py-[3px] rounded-full shrink-0 ${isFetching ? 'text-accent bg-accent-subtle' : 'text-success bg-success-subtle'}`}>
          <span className={`w-[6px] h-[6px] rounded-full shrink-0 ${isFetching ? 'bg-accent' : 'bg-success'}`} style={{ animation: isFetching ? 'none' : 'pulse-dot 1.6s infinite' }} />
          {isFetching ? 'Refreshing…' : 'Live'}
        </span>
        <div className="flex-1 min-w-[260px] max-w-[420px] flex items-center gap-2 px-3 py-2 bg-card rounded-[10px] text-[13px] text-muted" style={{ boxShadow: 'var(--shadow-pill)' }}>
          <SearchIcon size={13} className="shrink-0" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by trace ID, content, or model…"
            className="flex-1 bg-transparent border-none outline-none text-primary text-[13px] font-[inherit]"
          />
        </div>
        <FilterDropdown
          label="Agent:"
          value={agentFilter || '__all'}
          active={!!agentFilter}
          accent={agentFilter ? agentColor(agentFilter) : undefined}
          options={[
            { key: '__all', label: 'All agents' },
            ...agents.map(a => ({ key: a.id, label: a.name, accent: agentColor(a.id) })),
          ]}
          onChange={(key) => { setAgentFilter(key === '__all' ? '' : key); setPage(1); }}
          width={220}
        />
        <FilterDropdown
          label="Range:"
          value={range}
          active
          options={RANGES.map(r => ({ key: r.key, label: r.label }))}
          onChange={(key) => { setRange(key); setPage(1); }}
          width={140}
        />
        <button
          type="button"
          role="switch"
          aria-checked={showSystem}
          onClick={() => { setShowSystem(v => !v); setPage(1); }}
          title={showSystem ? 'Hide traces from system agents' : 'Show traces from system agents'}
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-[10px] text-[12.5px] font-medium cursor-pointer transition-colors duration-200 border-none ${showSystem ? 'text-accent bg-accent-subtle' : 'text-secondary bg-card'}`}
          style={{ boxShadow: showSystem ? '0 0 0 1px var(--accent-primary), var(--shadow-pill)' : 'var(--shadow-pill)' }}
        >
          <span
            className={`w-7 h-4 rounded-full relative transition-colors duration-200 ${showSystem ? 'bg-accent' : 'bg-[rgba(255,255,255,0.12)]'}`}
            aria-hidden="true"
          >
            <span
              className="absolute top-[2px] w-3 h-3 rounded-full bg-white transition-[left] duration-200"
              style={{ left: showSystem ? '14px' : '2px' }}
            />
          </span>
          System Traces
        </button>
      </div>

      {/* ── Grouped trace table ── */}
      <div className="fade-up bg-card rounded-[14px] overflow-hidden flex-1 min-h-0 flex flex-col" style={{ animationDelay: '120ms', boxShadow: 'var(--shadow-card)' }}>
        {/* Rows (header is sticky inside the scroll container so column widths match) */}
        <div className="flex-1 min-h-0 overflow-y-auto" style={{ scrollbarGutter: 'stable' }}>
        <div
          className="grid px-4 py-[8px] border-b border-b-[rgba(255,255,255,0.06)] sticky top-0 z-10 bg-card"
          style={{ gridTemplateColumns: GRID }}
        >
          {['Trace ID', 'Agent', 'Model', 'Status', 'Tools', 'Tokens', 'Latency', 'Time'].map((label, i) => (
            <span key={label} className={`text-[11px] font-semibold text-muted uppercase tracking-[0.06em] ${i === 7 ? 'text-right' : ''}`}>
              {label}
            </span>
          ))}
        </div>
        {rows.length === 0 ? (
          <div className="py-12 text-center text-muted text-[13px]">
            {isFetching ? 'Loading…' : 'No traces found.'}
          </div>
        ) : (
          rows.map(row =>
            row.type === 'flat' ? (
              <FlatTraceRow
                key={row.trace.id}
                trace={row.trace}
                selected={row.trace.id === selectedTrace?.id}
                onClick={() => setSelectedTrace(row.trace)}
              />
            ) : (
              <ConversationGroupRow
                key={row.conversationId}
                group={row}
                expanded={expandedConvs.has(row.conversationId)}
                onToggle={() => toggleConv(row.conversationId)}
                selectedId={selectedTrace?.id ?? null}
                onSelectTrace={setSelectedTrace}
              />
            )
          )
        )}
        </div>
      </div>

      {/* ── Pagination ── */}
      {total > PAGE_SIZE && (
        <div className="flex justify-center">
          <Pagination page={page} total={total} pageSize={PAGE_SIZE} onChange={setPage} />
        </div>
      )}

      {/* ── Trace detail drawer ── */}
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
