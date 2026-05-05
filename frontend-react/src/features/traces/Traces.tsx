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
    <span style={{ flex: 1, maxWidth: 60, height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 100, overflow: 'hidden', display: 'inline-block', verticalAlign: 'middle' }}>
      <span style={{ display: 'block', width: `${pct}%`, height: '100%', background: color, borderRadius: 100 }} />
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

  const rangeCountText = total === 0
    ? 'No traces'
    : `${((page - 1) * PAGE_SIZE + 1)}–${Math.min(page * PAGE_SIZE, total)} of ${total}`;

  return (
    <div style={{ width: '100%', maxWidth: 1320, margin: '0 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', paddingBottom: 24, scrollbarGutter: 'stable' }}>

      {/* ── Header ── */}
      <div className="fade-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>Traces</h1>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 100,
            color: isFetching ? 'var(--accent-primary)' : 'var(--success)',
            background: isFetching ? 'var(--accent-subtle)' : 'var(--success-subtle)',
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
              background: isFetching ? 'var(--accent-primary)' : 'var(--success)',
              animation: isFetching ? 'none' : 'pulse-dot 1.6s infinite',
            }} />
            {isFetching ? 'Refreshing…' : 'Live'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {RANGES.map(r => (
            <button
              key={r.key}
              onClick={() => { setRange(r.key); setPage(1); }}
              style={{
                padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 500,
                background: range === r.key ? 'var(--accent-subtle)' : 'transparent',
                color: range === r.key ? 'var(--accent-hover)' : 'var(--text-muted)',
                transition: 'background 0.12s, color 0.12s',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Agent filter cards ── */}
      {agents.length > 0 && (
        <div
          className="fade-up"
          style={{
            animationDelay: '40ms',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: 8,
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
                style={{
                  textAlign: 'left', background: 'var(--bg-card)', borderRadius: 12, padding: '12px 14px',
                  boxShadow: isActive
                    ? `0 0 0 1.5px ${c}88, 0 4px 16px -6px ${c}55`
                    : 'var(--shadow-card)',
                  position: 'relative', overflow: 'hidden',
                  transition: 'box-shadow 0.15s', border: 'none', cursor: 'pointer',
                }}
              >
                {/* Top color bar */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${c}, ${c}44)` }} />
                <div style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 4 }}>
                  {a.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                  <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: isActive ? c : 'var(--text-primary)' }}>{callCount || '—'}</span>
                  <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>traces</span>
                </div>
              </button>
            );
          })}
          {/* p95 latency tile — fixed slot, always same height */}
          {p95 != null && (
            <div style={{
              background: 'var(--bg-card)', borderRadius: 12, padding: '12px 14px',
              boxShadow: 'var(--shadow-card)', position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, var(--teal), transparent)' }} />
              <div style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)' }}>p95 Latency</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', fontFamily: "'JetBrains Mono',monospace", color: 'var(--teal)' }}>{fmtLatency(p95)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Search + count row ── */}
      <div className="fade-up" style={{ animationDelay: '80ms', display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Search box */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
          background: 'var(--bg-card)', borderRadius: 9, fontSize: 13,
          color: 'var(--text-muted)', boxShadow: 'var(--shadow-pill)',
          flex: '0 0 320px',
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by trace ID, model…"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit' }}
          />
        </div>

        {/* Active agent filter pill — fixed space so row doesn't reflow */}
        <div style={{ minWidth: 0, flex: 1 }}>
          {agentFilter && (
            <button
              onClick={() => setAgentFilter('')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 10px', borderRadius: 7,
                background: agentColor(agentFilter) + '16',
                border: `1px solid ${agentColor(agentFilter)}44`,
                color: agentColor(agentFilter), fontSize: 12, fontWeight: 600,
              }}
            >
              {agents.find(a => a.id === agentFilter)?.name ?? 'Agent'}
              <span style={{ opacity: 0.7 }}>✕</span>
            </button>
          )}
        </div>

        {/* Count */}
        <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>
          {rangeCountText}
        </span>
      </div>

      {/* ── Table ── */}
      <div className="fade-up" style={{ animationDelay: '120ms', background: 'var(--bg-card)', borderRadius: 14, boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
        {/* Column headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '180px 1fr 140px 72px 130px 120px 80px',
          padding: '10px 16px',
          fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)',
          letterSpacing: '0.07em', textTransform: 'uppercase',
          borderBottom: '1px solid var(--hairline)',
        }}>
          <span>Trace ID</span>
          <span>Agent</span>
          <span>Model</span>
          <span>Status</span>
          <span>Tokens</span>
          <span>Latency</span>
          <span style={{ textAlign: 'right' }}>Time</span>
        </div>

        {traces.length === 0 && (
          <div style={{ textAlign: 'center', padding: '56px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
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
              style={{
                display: 'grid', width: '100%', textAlign: 'left',
                gridTemplateColumns: '180px 1fr 140px 72px 130px 120px 80px',
                padding: '11px 16px', alignItems: 'center', fontSize: 12,
                background: 'transparent', borderTop: '1px solid var(--hairline)',
                transition: 'background 0.1s', border: 'none', cursor: 'pointer',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(201,148,74,0.04)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {/* Trace ID */}
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span style={{ width: 3, height: 18, borderRadius: 2, background: c, flexShrink: 0 }} />
                <span className="mono" style={{ color: 'var(--text-primary)', fontSize: 11 }}>
                  {trace.id.slice(0, 8)}…{trace.id.slice(-4)}
                </span>
              </span>
              {/* Agent */}
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>
                {trace.agentName ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}
              </span>
              {/* Model */}
              <span style={{ overflow: 'hidden' }}>
                <Pill label={trace.model} color={modelColor(trace.model)} size="sm" />
              </span>
              {/* Status */}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <StatusDot httpStatus={trace.httpStatus} />
                <span className="mono" style={{
                  fontSize: 11,
                  color: statusOk ? 'var(--success)' : statusErr ? 'var(--danger)' : 'var(--warn)',
                }}>{trace.httpStatus}</span>
              </span>
              {/* Tokens */}
              <span className="mono" style={{ fontSize: 11 }}>
                <span style={{ color: 'var(--text-primary)' }}>{fmtTokens(tokTotal)}</span>
                <span style={{ color: 'var(--text-muted)', marginLeft: 5, fontSize: 10 }}>
                  {fmtTokens(trace.inputTokens)}/{fmtTokens(trace.outputTokens)}
                </span>
              </span>
              {/* Latency */}
              <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span className="mono" style={{
                  fontSize: 11, minWidth: 40, flexShrink: 0,
                  color: trace.durationMs > 3000 ? 'var(--warn)' : 'var(--text-secondary)',
                }}>{fmtLatency(trace.durationMs)}</span>
                <LatencyBar ms={trace.durationMs} />
              </span>
              {/* Time */}
              <span style={{ color: 'var(--text-muted)', fontSize: 11, textAlign: 'right', whiteSpace: 'nowrap' }}>
                {fmtRelative(trace.createdAt)}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Pagination ── */}
      {total > PAGE_SIZE && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
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
