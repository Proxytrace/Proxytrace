import { useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { agentCallsApi } from '../../api/agent-calls';
import { agentsApi } from '../../api/agents';
import { statisticsApi } from '../../api/statistics';
import type { AgentCallDto } from '../../api/models';
import { Pagination } from '../../components/ui/Pagination';
import { Pill } from '../../components/ui/Pill';
import { StatusDot } from '../../components/ui/StatusDot';
import { useTraceStream } from '../../api/event-stream';
import { agentColor, modelColor } from '../../lib/colors';
import { fmtLatency, fmtRelative, fmtTokens } from '../../lib/format';
import { TraceDetail } from './TraceDetail';

const PAGE_SIZE = 20;

function FilterChip({ label, value, active, onClick, accent }: {
  label: string; value: string; active?: boolean; onClick?: () => void; accent?: string;
}) {
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-[6px] px-[10px] py-[6px] rounded-[8px] text-[12px] font-medium whitespace-nowrap cursor-pointer ${active ? 'bg-card-2 text-primary' : 'bg-card text-secondary'}`} style={{ boxShadow: active ? '0 1px 0 rgba(255,255,255,0.06) inset, 0 1px 2px rgba(0,0,0,0.3)' : 'var(--shadow-pill)' }}>
      {accent && <span className="w-[7px] h-[7px] rounded-[2px] shrink-0" style={{ background: accent }} />}
      <span className="text-muted font-medium">{label}</span>
      <span>{value}</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted ml-[2px]">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  );
}
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
    queryKey: ['agent-calls', filter],
    queryFn: () => agentCallsApi.list(filter),
    placeholderData: keepPreviousData,
  });

  const { data: agentsData } = useQuery({ queryKey: ['agents'], queryFn: () => agentsApi.list({ pageSize: 200 }) });
  const { data: modelBreakdown = [] } = useQuery({
    queryKey: ['model-breakdown', from, agentFilter],
    queryFn: () => statisticsApi.modelBreakdown({ from, agentId: agentFilter || undefined }),
  });
  const { data: latencyStats = [] } = useQuery({
    queryKey: ['latency', from, agentFilter],
    queryFn: () => statisticsApi.latency({ from, agentId: agentFilter || undefined }),
  });

  const traces = data?.items ?? [];
  const total = data?.total ?? 0;
  const agents = agentsData?.items ?? [];
  const p95 = latencyStats[0]?.p95Ms ?? null;

  useTraceStream(useCallback(() => {
    qc.invalidateQueries({ queryKey: ['agent-calls'] });
    qc.invalidateQueries({ queryKey: ['model-breakdown'] });
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
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
            Export CSV
          </button>
          <button className="px-[14px] py-2 rounded-[9px] text-[12.5px] font-semibold text-white inline-flex items-center gap-[6px]" style={{ background: 'linear-gradient(135deg, var(--accent-primary), #a57038)', boxShadow: '0 4px 14px -4px rgba(201,148,74,0.4), inset 0 1px 0 rgba(255,255,255,0.15)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
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
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
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
        {/* Column headers */}
        <div className="grid px-4 py-[10px] text-[10.5px] font-semibold text-muted tracking-[0.07em] uppercase border-b border-hairline" style={{ gridTemplateColumns: '180px 1fr 140px 72px 130px 120px 80px' }}>
          <span>Trace ID</span>
          <span>Agent</span>
          <span>Model</span>
          <span>Status</span>
          <span>Tokens</span>
          <span>Latency</span>
          <span className="text-right">Time</span>
        </div>

        {traces.length === 0 && (
          <div className="text-center px-5 py-[56px] text-muted text-[13px]">
            {isFetching ? 'Loading…' : 'No traces found.'}
          </div>
        )}

        {traces.map((trace, idx) => {
          const c = trace.agentId ? agentColor(trace.agentId) : modelColor(trace.model);
          const tokTotal = trace.inputTokens + trace.outputTokens;
          const statusOk = trace.httpStatus >= 200 && trace.httpStatus < 300;
          const statusErr = trace.httpStatus >= 500;
          return (
            <button
              key={trace.id}
              onClick={() => { setSelectedTrace(trace); setSelectedIdx(idx); }}
              className="grid w-full text-left px-4 py-[11px] items-center text-[12px] bg-transparent border-t border-hairline border-x-0 border-b-0 transition-[background] duration-[100ms] cursor-pointer"
              style={{ gridTemplateColumns: '180px 1fr 140px 72px 130px 120px 80px' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(201,148,74,0.04)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {/* Trace ID */}
              <span className="flex items-center gap-2 min-w-0">
                <span className="w-[3px] h-[18px] rounded-[2px] shrink-0" style={{ background: c }} />
                <span className="mono text-primary text-[11px]">
                  {trace.id.slice(0, 8)}…{trace.id.slice(-4)}
                </span>
              </span>
              {/* Agent */}
              <span className="text-[12px] text-secondary overflow-hidden text-ellipsis whitespace-nowrap pr-2">
                {trace.agentName ?? <span className="text-muted">—</span>}
              </span>
              {/* Model */}
              <span className="overflow-hidden">
                <Pill label={trace.model} color={modelColor(trace.model)} size="sm" />
              </span>
              {/* Status */}
              <span className="inline-flex items-center gap-[5px]">
                <StatusDot httpStatus={trace.httpStatus} />
                <span className={`mono text-[11px] ${statusOk ? 'text-success' : statusErr ? 'text-danger' : 'text-warn'}`}>{trace.httpStatus}</span>
              </span>
              {/* Tokens */}
              <span className="mono text-[11px]">
                <span className="text-primary">{fmtTokens(tokTotal)}</span>
                <span className="text-muted ml-[5px] text-[10px]">
                  {fmtTokens(trace.inputTokens)}/{fmtTokens(trace.outputTokens)}
                </span>
              </span>
              {/* Latency */}
              <span className="flex items-center gap-[7px]">
                <span className={`mono text-[11px] min-w-[40px] shrink-0 ${trace.durationMs > 3000 ? 'text-warn' : 'text-secondary'}`}>{fmtLatency(trace.durationMs)}</span>
                <LatencyBar ms={trace.durationMs} />
              </span>
              {/* Time */}
              <span className="text-muted text-[11px] text-right whitespace-nowrap">
                {fmtRelative(trace.createdAt)}
              </span>
            </button>
          );
        })}
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
