import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { statisticsApi } from '../../api/statistics';
import { agentCallsApi } from '../../api/agent-calls';
import { SparklesIcon } from '../../components/icons';
import type { AgentCallDto } from '../../api/models';
import { KpiCard } from '../../components/ui/KpiCard';
import { Pill } from '../../components/ui/Pill';
import { StatusDot } from '../../components/ui/StatusDot';
import { modelColor } from '../../lib/colors';
import { fmtLatency, fmtTokens, fmtRelative } from '../../lib/format';

// ── Types ─────────────────────────────────────────────────────────────────────

interface GridLine { y: number; val: string; isDashed: boolean; }
interface AreaChartData {
  linePath: string; areaPath: string;
  solidGridPath: string; dashedGridPath: string;
  grid: GridLine[];
  xLabels: { x: number; label: string }[];
  endX: number; endY: number;
}
interface SparklineData { path: string; endX: number; endY: number; }
interface HistRect { x: number; y: number; w: number; h: number; label: string; labelX: number; }
interface HistData { rects: HistRect[]; barsPath: string; baselineY: number; }
interface StackedBarData {
  bars: { label: string; labelX: number; labelY: number }[];
  grid: GridLine[];
  solidGridPath: string; dashedGridPath: string;
  colorPaths: { color: string; path: string }[];
  baselineY: number;
}

// ── Chart computation ─────────────────────────────────────────────────────────

function computeSparkline(data: number[], width: number, height: number): SparklineData {
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const pts = data.map((v, i) => [i * stepX, height - ((v - min) / range) * height]);
  const path = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return { path, endX: pts[pts.length - 1][0], endY: pts[pts.length - 1][1] };
}

function buildGridPaths(grid: GridLine[], x1: number, x2: number) {
  const solid = grid.filter(g => !g.isDashed).map(g => `M ${x1} ${g.y.toFixed(1)} L ${x2} ${g.y.toFixed(1)}`).join(' ');
  const dashed = grid.filter(g => g.isDashed).map(g => `M ${x1} ${g.y.toFixed(1)} L ${x2} ${g.y.toFixed(1)}`).join(' ');
  return { solidGridPath: solid, dashedGridPath: dashed };
}

function computeAreaChart(
  data: number[], width: number, height: number,
  padL: number, padR: number, padT: number, padB: number,
  showAxis: boolean,
): AreaChartData {
  const w = width - padL - padR, h = height - padT - padB;
  const max = Math.max(...data) * 1.15;
  const stepX = w / (data.length - 1);
  const pts = data.map((v, i) => [padL + i * stepX, padT + h - (v / max) * h]);
  const linePts = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const areaPath = `${linePts} L ${(padL + w).toFixed(1)} ${(padT + h).toFixed(1)} L ${padL} ${(padT + h).toFixed(1)} Z`;
  const yTicks = 4;
  const grid: GridLine[] = showAxis ? Array.from({ length: yTicks }, (_, i) => ({
    y: padT + (i / (yTicks - 1)) * h,
    val: String(Math.round(max * (1 - i / (yTicks - 1)))),
    isDashed: i !== yTicks - 1,
  })) : [];
  const xLabels = showAxis ? [0, 6, 12, 18, 23].map(i => ({
    x: padL + i * stepX, label: `${24 - i}h`,
  })) : [];
  const { solidGridPath, dashedGridPath } = buildGridPaths(grid, padL, padL + w);
  return { linePath: linePts, areaPath, solidGridPath, dashedGridPath, grid, xLabels, endX: pts[pts.length - 1][0], endY: pts[pts.length - 1][1] };
}

function computeHistogram(data: number[], width: number, height: number): HistData {
  const padL = 38, padR = 10, padT = 10, padB = 24;
  const w = width - padL - padR, h = height - padT - padB;
  const max = Math.max(...data) * 1.1;
  const bw = w / data.length * 0.86, gap = w / data.length * 0.14;
  const labels = ['0', '.5s', '1s', '1.5s', '2s', '2.5s', '3s', '3.5s', '4s', '5s+'];
  const rects: HistRect[] = data.map((v, i) => ({
    x: padL + i * (bw + gap) + gap / 2, w: bw,
    y: padT + h - (v / max) * h, h: (v / max) * h,
    label: labels[i], labelX: padL + i * (bw + gap) + gap / 2 + bw / 2,
  }));
  const barsPath = rects.map(r =>
    `M ${r.x.toFixed(1)} ${r.y.toFixed(1)} h ${r.w.toFixed(1)} v ${r.h.toFixed(1)} h -${r.w.toFixed(1)} Z`
  ).join(' ');
  return { rects, barsPath, baselineY: padT + h };
}

type TokenDay = { d: string; support: number; code: number; triage: number; classify: number };

function computeStackedBars(data: TokenDay[], width: number, height: number): StackedBarData {
  const padL = 38, padR = 10, padT = 14, padB = 28;
  const w = width - padL - padR, h = height - padT - padB;
  const totals = data.map(d => d.support + d.code + d.triage + d.classify);
  const max = Math.max(...totals) * 1.1;
  const bw = w / data.length * 0.58, gap = w / data.length * 0.42;
  const yTicks = 4;
  const grid: GridLine[] = Array.from({ length: yTicks }, (_, i) => ({
    y: padT + (i / (yTicks - 1)) * h,
    val: Math.round(max * (1 - i / (yTicks - 1)) / 1000) + 'k',
    isDashed: i !== yTicks - 1,
  }));
  const segsSpec = [
    { key: 'support' as const, color: '#c9944a' },
    { key: 'code' as const, color: '#6b9eaa' },
    { key: 'triage' as const, color: '#3daa6f' },
    { key: 'classify' as const, color: '#d4915c' },
  ];
  const pathsByColor: Record<string, string[]> = {};
  segsSpec.forEach(s => { pathsByColor[s.color] = []; });

  const bars = data.map((d, i) => {
    const x = padL + i * (bw + gap) + gap / 2;
    let y = padT + h;
    segsSpec.forEach(spec => {
      const segH = (d[spec.key] / max) * h;
      const rectY = y - segH;
      y = rectY;
      pathsByColor[spec.color].push(
        `M ${x.toFixed(1)} ${rectY.toFixed(1)} h ${bw.toFixed(1)} v ${segH.toFixed(1)} h -${bw.toFixed(1)} Z`
      );
    });
    return { label: d.d, labelX: x + bw / 2, labelY: height - 10 };
  });

  const colorPaths = segsSpec.map(s => ({ color: s.color, path: pathsByColor[s.color].join(' ') }));
  const { solidGridPath, dashedGridPath } = buildGridPaths(grid, padL, padL + w);
  return { bars, grid, solidGridPath, dashedGridPath, colorPaths, baselineY: padT + h };
}

// ── Static mock data ──────────────────────────────────────────────────────────

const VOLUME_RAW = [2, 4, 3, 1, 0, 2, 5, 8, 12, 18, 14, 22, 28, 34, 29, 36, 40, 32, 26, 20, 14, 18, 22, 15];
const LATENCY_HIST_RAW = [3, 8, 22, 45, 38, 28, 15, 9, 4, 2];
const PASS_RATE_RAW = [42, 55, 61, 68, 72, 78, 82, 85];
const TOKEN_BY_DAY: TokenDay[] = [
  { d: 'Mon', support: 7400, code: 3200, triage: 2100, classify: 900 },
  { d: 'Tue', support: 8600, code: 3900, triage: 2400, classify: 1200 },
  { d: 'Wed', support: 7100, code: 3600, triage: 1900, classify: 800 },
  { d: 'Thu', support: 9800, code: 4400, triage: 2800, classify: 1100 },
  { d: 'Fri', support: 10600, code: 5000, triage: 3100, classify: 1400 },
  { d: 'Sat', support: 6000, code: 2700, triage: 1500, classify: 600 },
  { d: 'Sun', support: 6700, code: 3100, triage: 1700, classify: 700 },
];
const AGENT_CARDS = [
  { name: 'Customer Support', model: 'gpt-4o', version: 'v2', traces: 34, pass: 82, trend: [40, 50, 55, 62, 68, 75, 82], tokens: 56200, latency: '1.9s' },
  { name: 'Code Helper', model: 'gpt-4o-mini', version: 'v1', traces: 18, pass: 67, trend: [30, 42, 48, 50, 55, 62, 67], tokens: 25900, latency: '2.4s' },
  { name: 'Ticket Triage', model: 'claude-3.5-sonnet', version: 'v2', traces: 12, pass: 78, trend: [50, 55, 62, 68, 70, 74, 78], tokens: 15500, latency: '1.2s' },
  { name: 'Classifier', model: 'gpt-3.5-turbo', version: 'v3', traces: 8, pass: 45, trend: [60, 55, 52, 48, 46, 44, 45], tokens: 6700, latency: '4.7s' },
];
const AGENT_COLOR_ENTRIES = [
  { name: 'Customer Support', color: '#c9944a' },
  { name: 'Code Helper', color: '#6b9eaa' },
  { name: 'Ticket Triage', color: '#3daa6f' },
  { name: 'Classifier', color: '#d4915c' },
];

// ── Range helpers ─────────────────────────────────────────────────────────────

function rangeFrom(key: string): string {
  const now = new Date();
  if (key === '1h') now.setHours(now.getHours() - 1);
  else if (key === '24h') now.setHours(now.getHours() - 24);
  else if (key === '7d') now.setDate(now.getDate() - 7);
  else now.setDate(now.getDate() - 30);
  return now.toISOString();
}

function rangeLabel(r: string): string {
  if (r === '1h') return 'Last hour · 5-minute buckets';
  if (r === '24h') return 'Last 24 hours · hourly buckets';
  if (r === '7d') return 'Last 7 days · daily buckets';
  return 'Last 30 days · daily buckets';
}

// ── Recent trace row ──────────────────────────────────────────────────────────

function TraceRow({ trace }: { trace: AgentCallDto }) {
  return (
    <div className="trace-row grid items-center px-[18px] py-[10px] border-b border-border-subtle" style={{ gridTemplateColumns: '1.6fr 1.4fr 0.7fr 0.8fr 0.9fr 0.3fr' }}>
      <span className="mono text-xs text-primary truncate">{trace.id.slice(0, 13)}…</span>
      <Pill label={trace.model} color={modelColor(trace.model)} size="sm" />
      <StatusDot httpStatus={trace.httpStatus} />
      <span className="mono text-[11px] text-secondary">{fmtTokens(trace.inputTokens + trace.outputTokens)}</span>
      <span className="mono text-[11px] text-secondary">{fmtLatency(trace.durationMs)}</span>
      <span className="text-[11px] text-muted text-right">{fmtRelative(trace.createdAt)}</span>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [range, setRange] = useState('24h');
  const from = rangeFrom(range);

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['statistics-summary', from],
    queryFn: () => statisticsApi.summary({ from }),
    refetchInterval: 30_000,
  });

  const { data: tracesData, isLoading: tracesLoading } = useQuery({
    queryKey: ['agent-calls-recent', from],
    queryFn: () => agentCallsApi.list({ page: 1, pageSize: 7, from }),
    refetchInterval: 30_000,
  });

  const recentTraces = tracesData?.items ?? [];

  const charts = useMemo(() => {
    const volumeArea = computeAreaChart(VOLUME_RAW, 820, 240, 38, 10, 14, 24, true);
    const passRateArea = computeAreaChart(PASS_RATE_RAW, 360, 120, 4, 4, 4, 4, false);
    const histData = computeHistogram(LATENCY_HIST_RAW, 360, 200);
    const stackedBarData = computeStackedBars(TOKEN_BY_DAY, 820, 220);
    const kpiSparklines = {
      traces: computeSparkline(VOLUME_RAW, 72, 24),
      tokens: computeSparkline(TOKEN_BY_DAY.map(d => d.support + d.code + d.triage + d.classify), 72, 24),
      latency: computeSparkline([3100, 2900, 2700, 2800, 2600, 2500, 2400, 2800], 72, 24),
      passRate: computeSparkline(PASS_RATE_RAW, 72, 24),
    };
    const agentCards = AGENT_CARDS.map(a => ({
      ...a,
      sparkline: computeSparkline(a.trend, 64, 24),
      passColor: a.pass >= 75 ? 'var(--success)' : a.pass >= 55 ? 'var(--warn)' : 'var(--danger)',
    }));
    const r = 37;
    const circumference = 2 * Math.PI * r;
    const passRate = summary?.overallPassRate ?? 0.82;
    const dashoffset = circumference - passRate * circumference;
    return { volumeArea, passRateArea, histData, stackedBarData, kpiSparklines, agentCards, circumference, dashoffset };
  }, [summary?.overallPassRate]);

  const totalTokens = (summary?.totalInputTokens ?? 0) + (summary?.totalOutputTokens ?? 0);

  return (
    <div className="w-full max-w-[1320px] mx-auto min-w-0 flex flex-col gap-4 pb-6">

      {/* Title row */}
      <div className="fade-up flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-bold tracking-[-0.02em] m-0 mb-1">Dashboard</h1>
          <p className="text-sm text-muted m-0">Overview of your agent tracing and evaluation activity.</p>
        </div>
        <div className="flex gap-1 p-1 bg-card rounded-[10px] shrink-0">
          {(['1h', '24h', '7d', '30d'] as const).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              style={{
                boxShadow: range === r ? '0 1px 0 rgba(255,255,255,0.06) inset, 0 1px 2px rgba(0,0,0,0.25)' : 'none',
              }}
              className={`px-3 py-[6px] text-xs font-medium rounded-[7px] cursor-pointer ${
                range === r ? 'bg-card-2 text-primary' : 'bg-transparent text-muted'
              }`}
            >{r}</button>
          ))}
        </div>
      </div>

      {/* KPI Row */}
      <div className="fade-up grid gap-3" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <KpiCard
          title="Total Traces"
          value={summaryLoading ? '…' : String(summary?.totalCalls ?? 0)}
          subtitle="LLM calls captured"
          trend={{ direction: 'up', pct: '+24%', positive: true }}
          sparkline={VOLUME_RAW}
          sparklineColor="#c9944a"
          accent
        />
        <KpiCard
          title="Total Tokens"
          value={summaryLoading ? '…' : fmtTokens(totalTokens)}
          subtitle={summaryLoading ? '' : `${(summary?.totalInputTokens ?? 0).toLocaleString()} in · ${(summary?.totalOutputTokens ?? 0).toLocaleString()} out`}
          trend={{ direction: 'up', pct: '+12%', positive: true }}
          sparkline={TOKEN_BY_DAY.map(d => d.support + d.code + d.triage + d.classify)}
          sparklineColor="#6b9eaa"
        />
        <KpiCard
          title="Avg Latency"
          value={summaryLoading ? '…' : fmtLatency(summary?.avgLatencyMs ?? 0)}
          subtitle="p95 4.1s · p99 6.2s"
          trend={{ direction: 'down', pct: '-8%', positive: false }}
          sparkline={[3100, 2900, 2700, 2800, 2600, 2500, 2400, 2800]}
          sparklineColor="#d4915c"
        />
        <KpiCard
          title="Pass Rate"
          value={summaryLoading ? '…' : `${Math.round((summary?.overallPassRate ?? 0) * 100)}%`}
          subtitle="8 runs · Support suite v2"
          trend={{ direction: 'up', pct: '+7pt', positive: true }}
          sparkline={PASS_RATE_RAW}
          sparklineColor="#3daa6f"
        />
      </div>

      {/* Charts Row 1: Trace Volume + Latency Distribution */}
      <div className="fade-up grid gap-3" style={{ gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)' }}>

        {/* Trace Volume area chart */}
        <div className="dash-card">
          <div className="card-header">
            <div className="min-w-0 flex-1">
              <h3>Trace Volume</h3>
              <p>{rangeLabel(range)}</p>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted shrink-0">
              <span className="w-2 h-2 rounded-[2px] inline-block" style={{ background: '#c9944a' }} />
              Traces
            </div>
          </div>
          <div className="card-body px-[18px] pb-[18px] pt-0">
            <svg viewBox="0 0 820 240" width="100%" height="240" style={{ display: 'block', overflow: 'visible' }} preserveAspectRatio="none">
              <defs>
                <linearGradient id="volGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#c9944a" stopOpacity="0.30" />
                  <stop offset="100%" stopColor="#c9944a" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={charts.volumeArea.solidGridPath} stroke="#343438" strokeWidth="1" fill="none" />
              <path d={charts.volumeArea.dashedGridPath} stroke="#343438" strokeWidth="1" strokeDasharray="3 4" fill="none" />
              {charts.volumeArea.grid.map((g, i) => (
                <text key={i} x="30" y={g.y + 4} textAnchor="end" fill="#67645e" fontSize="10" fontFamily="JetBrains Mono, monospace">{g.val}</text>
              ))}
              <path d={charts.volumeArea.areaPath} fill="url(#volGrad)" />
              <path d={charts.volumeArea.linePath} fill="none" stroke="#c9944a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx={charts.volumeArea.endX} cy={charts.volumeArea.endY} r="8" fill="#c9944a" opacity="0.15" />
              <circle cx={charts.volumeArea.endX} cy={charts.volumeArea.endY} r="4" fill="#c9944a" />
              <circle cx={charts.volumeArea.endX} cy={charts.volumeArea.endY} r="2" fill="var(--bg-card)" />
              {charts.volumeArea.xLabels.map((l, i) => (
                <text key={i} x={l.x} y="234" textAnchor="middle" fill="#67645e" fontSize="10" fontFamily="JetBrains Mono, monospace">{l.label}</text>
              ))}
            </svg>
          </div>
        </div>

        {/* Latency Distribution histogram */}
        <div className="dash-card">
          <div className="card-header">
            <div className="min-w-0 flex-1">
              <h3>Latency Distribution</h3>
              <p>60 samples · p95 4.1s</p>
            </div>
          </div>
          <div className="card-body">
            <svg viewBox="0 0 360 200" width="100%" height="200" style={{ display: 'block' }} preserveAspectRatio="none">
              <line x1="38" x2="350" y1={charts.histData.baselineY} y2={charts.histData.baselineY} stroke="#343438" />
              <path d={charts.histData.barsPath} fill="#6b9eaa" opacity="0.85" />
              {charts.histData.rects.map((r, i) => (
                <text key={i} x={r.labelX} y="192" textAnchor="middle" fill="#67645e" fontSize="9" fontFamily="JetBrains Mono, monospace">{r.label}</text>
              ))}
            </svg>
            <div className="flex gap-4 mt-3 pt-3 border-t border-border-subtle">
              {[['p50', '2.4s'], ['p90', '3.8s'], ['p95', '4.1s'], ['p99', '6.2s']].map(([k, v]) => (
                <div key={k}>
                  <div className="text-[11px] text-muted font-medium tracking-[0.05em] uppercase">{k}</div>
                  <div className="mono text-sm font-semibold mt-[2px]">{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row 2: Token Usage + Pass Rate */}
      <div className="fade-up grid gap-3" style={{ gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)' }}>

        {/* Token Usage stacked bar */}
        <div className="dash-card">
          <div className="card-header">
            <div className="min-w-0 flex-1">
              <h3>Token Usage by Agent</h3>
              <p>Last 7 days · stacked</p>
            </div>
            <div className="flex gap-[10px] text-[11px] text-secondary flex-wrap justify-end max-w-[300px] shrink-0">
              {AGENT_COLOR_ENTRIES.map(e => (
                <div key={e.name} className="flex items-center gap-[5px]">
                  <span className="w-2 h-2 rounded-[2px] inline-block" style={{ background: e.color }} />
                  {e.name}
                </div>
              ))}
            </div>
          </div>
          <div className="card-body px-[18px] pb-[18px] pt-0">
            <svg viewBox="0 0 820 220" width="100%" height="220" style={{ display: 'block' }} preserveAspectRatio="none">
              <path d={charts.stackedBarData.solidGridPath} stroke="#343438" fill="none" />
              <path d={charts.stackedBarData.dashedGridPath} stroke="#343438" fill="none" strokeDasharray="3 4" />
              {charts.stackedBarData.grid.map((g, i) => (
                <text key={i} x="30" y={g.y + 4} textAnchor="end" fill="#67645e" fontSize="10" fontFamily="JetBrains Mono, monospace">{g.val}</text>
              ))}
              {charts.stackedBarData.colorPaths.map(cp => (
                <path key={cp.color} d={cp.path} fill={cp.color} />
              ))}
              {charts.stackedBarData.bars.map((b, i) => (
                <text key={i} x={b.labelX} y={b.labelY} textAnchor="middle" fill="#67645e" fontSize="10" fontFamily="JetBrains Mono, monospace">{b.label}</text>
              ))}
            </svg>
          </div>
        </div>

        {/* Pass Rate Over Runs */}
        <div className="dash-card">
          <div className="card-header">
            <div className="min-w-0 flex-1">
              <h3>Pass Rate Over Runs</h3>
              <p>Customer Support · Suite v2</p>
            </div>
          </div>
          <div className="card-body">
            <div className="flex items-center gap-[18px] py-1 pb-4">
              <svg width="80" height="80" style={{ display: 'block', transform: 'rotate(-90deg)', flexShrink: 0 }}>
                <circle cx="40" cy="40" r="37" fill="none" stroke="#343438" strokeWidth="6" />
                <circle
                  cx="40" cy="40" r="37" fill="none" stroke="#3daa6f" strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={charts.circumference}
                  strokeDashoffset={charts.dashoffset}
                  style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                />
              </svg>
              <div>
                <div className="text-[30px] font-bold tracking-[-0.02em] text-success">
                  {Math.round((summary?.overallPassRate ?? 0.82) * 100)}<span className="text-[18px] text-muted">%</span>
                </div>
                <div className="text-xs text-muted">last run · +7pt vs prev</div>
              </div>
            </div>
            <svg viewBox="0 0 360 120" width="100%" height="120" style={{ display: 'block' }} preserveAspectRatio="none">
              <defs>
                <linearGradient id="passGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#3daa6f" stopOpacity="0.30" />
                  <stop offset="100%" stopColor="#3daa6f" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={charts.passRateArea.areaPath} fill="url(#passGrad)" />
              <path d={charts.passRateArea.linePath} fill="none" stroke="#3daa6f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx={charts.passRateArea.endX} cy={charts.passRateArea.endY} r="4" fill="#3daa6f" />
              <circle cx={charts.passRateArea.endX} cy={charts.passRateArea.endY} r="2" fill="var(--bg-card)" />
            </svg>
            <div className="flex justify-between text-[10px] text-muted mt-1 font-mono">
              <span>Run 1</span><span>Run 4</span><span>Run 8</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: Recent Traces + Agents */}
      <div className="fade-up grid gap-3" style={{ gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)' }}>

        {/* Recent Traces */}
        <div className="dash-card">
          <div className="card-header">
            <div className="min-w-0 flex-1"><h3>Recent Traces</h3></div>
            <Link to="/traces" className="text-xs text-accent-hover font-medium pr-[18px] whitespace-nowrap no-underline">View all →</Link>
          </div>
          <div className="card-body-flush">
            <div className="grid px-[18px] py-[10px] text-[11px] font-semibold text-muted tracking-[0.05em] uppercase border-b border-border-subtle" style={{ gridTemplateColumns: '1.6fr 1.4fr 0.7fr 0.8fr 0.9fr 0.3fr' }}>
              <span>Trace ID</span><span>Model</span><span>Status</span><span>Tokens</span><span>Latency</span><span />
            </div>
            {tracesLoading && (
              <div className="p-8 px-[18px] text-center text-xs text-muted">Loading…</div>
            )}
            {!tracesLoading && recentTraces.length === 0 && (
              <div className="py-10 px-[18px] text-center">
                <p className="text-[13px] text-secondary m-0 mb-1">No traces yet</p>
                <p className="text-xs text-muted m-0">Route your agent through the Trsr proxy to start capturing traces.</p>
              </div>
            )}
            {recentTraces.map(trace => <TraceRow key={trace.id} trace={trace} />)}
          </div>
        </div>

        {/* Agent Cards */}
        <div className="dash-card">
          <div className="card-header">
            <div className="min-w-0 flex-1">
              <h3>Agents</h3>
              <p>Detected from traces</p>
            </div>
          </div>
          <div className="card-body flex flex-col gap-[10px] px-[18px] py-[14px]">
            {charts.agentCards.map(agent => (
              <div key={agent.name} className="grid p-3 bg-card-2 rounded-xl items-center gap-3" style={{ gridTemplateColumns: '1fr auto auto', boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 1px 2px rgba(0,0,0,0.25)' }}>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-semibold">{agent.name}</span>
                    <span className="mono text-[10px] px-[5px] py-[1px] bg-card rounded-[4px] text-muted">{agent.version}</span>
                  </div>
                  <div className="mt-[5px] flex gap-1.5 items-center">
                    <Pill label={agent.model} color={modelColor(agent.model)} size="sm" />
                    <span className="text-[11px] text-muted">· {agent.traces} traces</span>
                  </div>
                </div>
                <svg viewBox="0 0 64 24" width="64" height="24" style={{ display: 'block' }}>
                  <path d={agent.sparkline.path} fill="none" stroke={agent.passColor} strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx={agent.sparkline.endX} cy={agent.sparkline.endY} r="2" fill={agent.passColor} />
                </svg>
                <div className="text-right">
                  <div style={{ fontSize: 14, fontWeight: 700, color: agent.passColor }}>{agent.pass}%</div>
                  <div className="text-[10px] text-muted uppercase tracking-[0.05em]">pass</div>
                </div>
              </div>
            ))}

            {/* Proposals teaser */}
            <div className="flex gap-[10px] items-start p-3 rounded-xl mt-1" style={{ background: 'linear-gradient(135deg, rgba(201,148,74,0.10), rgba(107,158,170,0.07))', boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 2px 4px rgba(0,0,0,0.2)' }}>
              <div className="w-7 h-7 rounded-[7px] shrink-0 flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg, #c9944a, #6b9eaa)' }}>
                <SparklesIcon size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold">2 optimization proposals ready</div>
                <div className="text-[11px] text-secondary mt-[2px]">Est. +14% pass rate for Customer Support</div>
              </div>
              <button className="text-[11px] font-semibold text-accent-hover px-[10px] py-[5px] rounded-md bg-accent-subtle cursor-pointer whitespace-nowrap shrink-0">Review</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
