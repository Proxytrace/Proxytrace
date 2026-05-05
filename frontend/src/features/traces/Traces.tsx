import { useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { agentCallsApi } from '../../api/agent-calls';
import { agentsApi } from '../../api/agents';
import { statisticsApi } from '../../api/statistics';
import { QUERY_KEYS } from '../../api/query-keys';
import { ExternalLinkIcon, PlusIcon, SearchIcon } from '../../components/icons';
import type { AgentCallDto } from '../../api/models';
import { Pagination } from '../../components/ui/Pagination';
import { Pill } from '../../components/ui/Pill';
import { StatusDot } from '../../components/ui/StatusDot';
import { DataTable } from '../../components/ui/DataTable';
import type { DataColumn } from '../../components/ui/DataTable';
import { useTraceStream } from '../../api/event-stream';
import { agentColor, modelColor } from '../../lib/colors';
import { fmtLatency, fmtRelative, fmtTokens } from '../../lib/format';
import { TraceDetail } from './TraceDetail';
import { FilterChip } from '../../components/ui/FilterChip';
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

const TRACES_COLUMNS: DataColumn<AgentCallDto>[] = [
  {
    key: 'id', label: 'Trace ID', width: '180px',
    render: trace => {
      const c = trace.agentId ? agentColor(trace.agentId) : modelColor(trace.model);
      return (
        <span className="flex items-center gap-2 min-w-0">
          <span className="w-[3px] h-[18px] rounded-[2px] shrink-0" style={{ background: c }} />
          <span className="mono text-primary text-[11px]">{trace.id.slice(0, 8)}…{trace.id.slice(-4)}</span>
        </span>
      );
    },
  },
  {
    key: 'agent', label: 'Agent', width: '1fr',
    render: trace => (
      <span className="text-[12px] text-secondary overflow-hidden text-ellipsis whitespace-nowrap pr-2">
        {trace.agentName ?? <span className="text-muted">—</span>}
      </span>
    ),
  },
  {
    key: 'model', label: 'Model', width: '140px',
    render: trace => <span className="overflow-hidden"><Pill label={trace.model} color={modelColor(trace.model)} size="sm" /></span>,
  },
  {
    key: 'status', label: 'Status', width: '72px',
    render: trace => {
      const ok = trace.httpStatus >= 200 && trace.httpStatus < 300;
      const err = trace.httpStatus >= 500;
      return (
        <span className="inline-flex items-center gap-[5px]">
          <StatusDot httpStatus={trace.httpStatus} />
          <span className={`mono text-[11px] ${ok ? 'text-success' : err ? 'text-danger' : 'text-warn'}`}>{trace.httpStatus}</span>
        </span>
      );
    },
  },
  {
    key: 'tokens', label: 'Tokens', width: '130px',
    render: trace => (
      <span className="mono text-[11px]">
        <span className="text-primary">{fmtTokens(trace.inputTokens + trace.outputTokens)}</span>
        <span className="text-muted ml-[5px] text-[10px]">{fmtTokens(trace.inputTokens)}/{fmtTokens(trace.outputTokens)}</span>
      </span>
    ),
  },
  {
    key: 'latency', label: 'Latency', width: '120px',
    render: trace => (
      <span className="flex items-center gap-[7px]">
        <span className={`mono text-[11px] min-w-[40px] shrink-0 ${trace.durationMs > 3000 ? 'text-warn' : 'text-secondary'}`}>{fmtLatency(trace.durationMs)}</span>
        <LatencyBar ms={trace.durationMs} />
      </span>
    ),
  },
  {
    key: 'time', label: 'Time', width: '80px', className: 'text-right',
    render: trace => <span className="text-muted text-[11px] whitespace-nowrap">{fmtRelative(trace.createdAt)}</span>,
  },
];

export default function Traces() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [range, setRange] = useState('24h');
  const [agentFilter, setAgentFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedTrace, setSelectedTrace] = useState<AgentCallDto | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number>(-1);

  const from = useMemo(() => rangeFrom(range), [range]);
  const filter = useMemo(() => ({
    page, pageSize: PAGE_SIZE,
    ...(agentFilter ? { agentId: agentFilter } : {}),
    ...(from ? { from } : {}),
  }), [page, agentFilter, from]);

  const { data, isFetching } = useQuery({
    queryKey: QUERY_KEYS.agentCalls(filter),
    queryFn: () => agentCallsApi.list(filter),
    placeholderData: keepPreviousData,
  });

  const { data: agentsData } = useQuery({ queryKey: QUERY_KEYS.agents, queryFn: () => agentsApi.list({ pageSize: 200 }) });
  const { data: modelBreakdown = [] } = useQuery({
    queryKey: QUERY_KEYS.statisticsModelBreakdown(from, agentFilter || undefined),
    queryFn: () => statisticsApi.modelBreakdown({ from, agentId: agentFilter || undefined }),
  });
  const { data: latencyStats = [] } = useQuery({
    queryKey: QUERY_KEYS.statisticsLatency(from, agentFilter || undefined),
    queryFn: () => statisticsApi.latency({ from, agentId: agentFilter || undefined }),
  });

  const traces = data?.items ?? [];
  const total = data?.total ?? 0;
  const agents = agentsData?.items ?? [];
  const p95 = latencyStats[0]?.p95Ms ?? null;

  useTraceStream(useCallback(() => {
    qc.invalidateQueries({ queryKey: ['agent-calls'] });
    qc.invalidateQueries({ queryKey: ['statistics-model-breakdown'] });
  }, [qc]));

  return (
    <div className="w-full max-w-[1320px] mx-auto min-w-0 flex flex-col gap-[14px] overflow-y-auto pb-6" style={{ scrollbarGutter: 'stable' }}>

      {/* ── Header ── */}
      <div className="fade-up flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-[10px] mb-[6px]">
            <h1 className="text-[24px] font-bold tracking-[-0.02em] m-0">Traces</h1>
            <span className={`inline-flex items-center gap-[5px] text-[11px] font-semibold px-2 py-[3px] rounded-full ${isFetching ? 'text-accent bg-accent-subtle' : 'text-success bg-success-subtle'}`}>
              <span className={`w-[6px] h-[6px] rounded-full shrink-0 ${isFetching ? 'bg-accent' : 'bg-success'}`} style={{ animation: isFetching ? 'none' : 'pulse-dot 1.6s infinite' }} />
              {isFetching ? 'Refreshing…' : 'Live'}
            </span>
          </div>
          <p className="text-[13.5px] text-muted m-0">Every LLM call captured by the proxy, grouped by agent.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button className="px-3 py-2 bg-card rounded-[9px] text-[12.5px] font-medium text-secondary inline-flex items-center gap-[6px]" style={{ boxShadow: 'var(--shadow-pill)' }}>
            <ExternalLinkIcon size={13} />
            Export CSV
          </button>
          <button className="px-[14px] py-2 rounded-[9px] text-[12.5px] font-semibold text-white inline-flex items-center gap-[6px]" style={{ background: 'linear-gradient(135deg, var(--accent-primary), #a57038)', boxShadow: '0 4px 14px -4px rgba(201,148,74,0.4), inset 0 1px 0 rgba(255,255,255,0.15)' }}>
            <PlusIcon size={13} strokeWidth={2.5} />
            New Test Case
          </button>
        </div>
      </div>

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
            const callCount = (modelBreakdown as { agentId?: string; callCount: number }[])
              .reduce((n, m) => m.agentId === a.id ? n + m.callCount : n, 0);
            return (
              <button
                key={a.id}
                onClick={() => setAgentFilter(isActive ? '' : a.id)}
                className="text-left bg-card rounded-xl px-[14px] py-3 relative overflow-hidden transition-[box-shadow] duration-[150ms] border-none cursor-pointer"
                style={{ boxShadow: isActive ? `0 0 0 1.5px ${c}88, 0 4px 16px -6px ${c}55` : 'var(--shadow-card)' }}
              >
                {/* Top color bar */}
                <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${c}, ${c}44)` }} />
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
          {/* p95 latency tile — fixed slot, always same height */}
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
      <div className="fade-up flex items-center gap-[10px] flex-wrap" style={{ animationDelay: '80ms' }}>
        {/* Search box */}
        <div className="flex-1 min-w-[260px] max-w-[420px] flex items-center gap-2 px-3 py-2 bg-card rounded-[10px] text-[13px] text-muted" style={{ boxShadow: 'var(--shadow-pill)' }}>
          <SearchIcon size={13} className="shrink-0" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by trace ID, content, or model…"
            className="flex-1 bg-transparent border-none outline-none text-primary text-[13px] font-[inherit]"
          />
        </div>

        {/* Agent filter chip */}
        <FilterChip
          label="Agent:"
          value={agentFilter ? (agents.find(a => a.id === agentFilter)?.name ?? 'Agent') : 'All agents'}
          active={!!agentFilter}
          accent={agentFilter ? agentColor(agentFilter) : undefined}
          onClick={() => setAgentFilter('')}
        />

        {/* Range chip */}
        <FilterChip
          label="Range:"
          value={RANGES.find(r => r.key === range)?.label ?? range}
          active
          onClick={() => {
            const idx = RANGES.findIndex(r => r.key === range);
            const next = RANGES[(idx + 1) % RANGES.length];
            setRange(next.key);
            setPage(1);
          }}
        />
      </div>

      {/* ── Table ── */}
      <div className="fade-up bg-card rounded-[14px] overflow-hidden" style={{ animationDelay: '120ms', boxShadow: 'var(--shadow-card)' }}>
        <DataTable
          columns={TRACES_COLUMNS}
          rows={traces}
          rowKey={t => t.id}
          onRowClick={(trace, idx) => { setSelectedTrace(trace); setSelectedIdx(idx); }}
          isSelected={trace => trace.id === selectedTrace?.id}
          emptyMessage={isFetching ? 'Loading…' : 'No traces found.'}
        />
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
          onPrev={selectedIdx > 0 ? () => {
            setSelectedTrace(traces[selectedIdx - 1]);
            setSelectedIdx(selectedIdx - 1);
          } : undefined}
          onNext={selectedIdx < traces.length - 1 ? () => {
            setSelectedTrace(traces[selectedIdx + 1]);
            setSelectedIdx(selectedIdx + 1);
          } : undefined}
        />
      )}
    </div>
  );
}
