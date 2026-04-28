import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StatisticsService } from '../../core/api/statistics.service';
import { AgentCallsService } from '../../core/api/agent-calls.service';
import { SummaryDto, AgentCallDto } from '../../core/api/models';

type LoadState = 'loading' | 'loaded' | 'error';

interface GridLine { y: number; val: string; isDashed: boolean; }
interface XLabel { x: number; label: string; }
interface AreaChartData {
  linePath: string; areaPath: string;
  solidGridPath: string; dashedGridPath: string;
  grid: GridLine[]; xLabels: XLabel[];
  endX: number; endY: number;
}
interface SparklineData { path: string; endX: number; endY: number; }
interface BarDay { label: string; labelX: number; labelY: number; }
interface StackedBarData {
  bars: BarDay[];
  grid: GridLine[];
  solidGridPath: string; dashedGridPath: string;
  colorPaths: Array<{ color: string; path: string }>;
  baselineY: number;
}
interface HistRect { x: number; y: number; w: number; h: number; label: string; labelX: number; }
interface HistData { rects: HistRect[]; barsPath: string; baselineY: number; }
interface AgentCard {
  name: string; model: string; version: string; traces: number; pass: number;
  tokens: number; latency: string; sparkline: SparklineData; passColor: string;
}

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  templateUrl: './dashboard.html',
  styles: ``,
})
export class Dashboard implements OnInit {
  readonly Math = Math;
  private readonly statisticsService = inject(StatisticsService);
  private readonly agentCallsService = inject(AgentCallsService);

  readonly summaryState = signal<LoadState>('loading');
  readonly summary = signal<SummaryDto | null>(null);
  readonly recentTracesState = signal<LoadState>('loading');
  readonly recentTraces = signal<AgentCallDto[]>([]);

  readonly volRange = signal('24h');

  // ── Mock chart data (real API for KPI values) ──────────────────────────────
  private readonly volumeRaw = [2, 4, 3, 1, 0, 2, 5, 8, 12, 18, 14, 22, 28, 34, 29, 36, 40, 32, 26, 20, 14, 18, 22, 15];
  private readonly latencyHistRaw = [3, 8, 22, 45, 38, 28, 15, 9, 4, 2];
  private readonly passRateRunsRaw = [42, 55, 61, 68, 72, 78, 82, 85];
  private readonly tokenByDayRaw = [
    { d: 'Mon', support: 7400, code: 3200, triage: 2100, classify: 900 },
    { d: 'Tue', support: 8600, code: 3900, triage: 2400, classify: 1200 },
    { d: 'Wed', support: 7100, code: 3600, triage: 1900, classify: 800 },
    { d: 'Thu', support: 9800, code: 4400, triage: 2800, classify: 1100 },
    { d: 'Fri', support: 10600, code: 5000, triage: 3100, classify: 1400 },
    { d: 'Sat', support: 6000, code: 2700, triage: 1500, classify: 600 },
    { d: 'Sun', support: 6700, code: 3100, triage: 1700, classify: 700 },
  ];
  readonly agentColorEntries = [
    { name: 'Customer Support', color: '#8b5cf6' },
    { name: 'Code Helper', color: '#06b6d4' },
    { name: 'Ticket Triage', color: '#10b981' },
    { name: 'Classifier', color: '#f59e0b' },
  ];

  // ── Precomputed chart data ─────────────────────────────────────────────────
  readonly volumeArea: AreaChartData;
  readonly passRateArea: AreaChartData;
  readonly histData: HistData;
  readonly stackedBarData: StackedBarData;
  readonly kpiSparklines: Record<string, SparklineData>;
  readonly agentCards: AgentCard[];
  readonly radialCircumference: number;
  readonly radialDashoffset: number;

  constructor() {
    this.volumeArea = this.computeAreaChart(this.volumeRaw, 820, 240, 38, 10, 14, 24, true);
    this.passRateArea = this.computeAreaChart(this.passRateRunsRaw, 360, 120, 4, 4, 4, 4, false);
    this.histData = this.computeHistogram(this.latencyHistRaw, 360, 200);
    this.stackedBarData = this.computeStackedBars(this.tokenByDayRaw, 820, 220);

    this.kpiSparklines = {
      traces: this.computeSparkline(this.volumeRaw, 72, 24),
      tokens: this.computeSparkline(this.tokenByDayRaw.map(d => d.support + d.code + d.triage + d.classify), 72, 24),
      latency: this.computeSparkline([3100, 2900, 2700, 2800, 2600, 2500, 2400, 2800], 72, 24),
      passRate: this.computeSparkline(this.passRateRunsRaw, 72, 24),
    };

    const r = (80 - 6) / 2;
    const c = 2 * Math.PI * r;
    this.radialCircumference = c;
    this.radialDashoffset = c - (82 / 100) * c;

    const agentRaw = [
      { name: 'Customer Support', model: 'gpt-4o', version: 'v2', traces: 34, pass: 82, trend: [40,50,55,62,68,75,82], tokens: 56200, latency: '1.9s' },
      { name: 'Code Helper', model: 'gpt-4o-mini', version: 'v1', traces: 18, pass: 67, trend: [30,42,48,50,55,62,67], tokens: 25900, latency: '2.4s' },
      { name: 'Ticket Triage', model: 'claude-3.5-sonnet', version: 'v2', traces: 12, pass: 78, trend: [50,55,62,68,70,74,78], tokens: 15500, latency: '1.2s' },
      { name: 'Classifier', model: 'gpt-3.5-turbo', version: 'v3', traces: 8, pass: 45, trend: [60,55,52,48,46,44,45], tokens: 6700, latency: '4.7s' },
    ];
    this.agentCards = agentRaw.map(a => ({
      name: a.name, model: a.model, version: a.version,
      traces: a.traces, pass: a.pass, tokens: a.tokens, latency: a.latency,
      sparkline: this.computeSparkline(a.trend, 64, 24),
      passColor: a.pass >= 75 ? 'var(--success)' : a.pass >= 55 ? 'var(--warn)' : 'var(--danger)',
    }));
  }

  // ── Private chart computation ──────────────────────────────────────────────

  private computeSparkline(data: number[], width: number, height: number): SparklineData {
    const max = Math.max(...data), min = Math.min(...data);
    const range = max - min || 1;
    const stepX = width / (data.length - 1);
    const pts = data.map((v, i) => [i * stepX, height - ((v - min) / range) * height]);
    const path = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    return { path, endX: pts[pts.length - 1][0], endY: pts[pts.length - 1][1] };
  }

  private buildGridPaths(grid: GridLine[], x1: number, x2: number): { solidGridPath: string; dashedGridPath: string } {
    const solid = grid.filter(g => !g.isDashed).map(g => `M ${x1} ${g.y.toFixed(1)} L ${x2} ${g.y.toFixed(1)}`).join(' ');
    const dashed = grid.filter(g => g.isDashed).map(g => `M ${x1} ${g.y.toFixed(1)} L ${x2} ${g.y.toFixed(1)}`).join(' ');
    return { solidGridPath: solid, dashedGridPath: dashed };
  }

  private computeAreaChart(
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
    const xLabels: XLabel[] = showAxis ? [0, 6, 12, 18, 23].map(i => ({
      x: padL + i * stepX, label: `${24 - i}h`,
    })) : [];
    const { solidGridPath, dashedGridPath } = this.buildGridPaths(grid, padL, padL + w);
    return { linePath: linePts, areaPath, solidGridPath, dashedGridPath, grid, xLabels, endX: pts[pts.length - 1][0], endY: pts[pts.length - 1][1] };
  }

  private computeHistogram(data: number[], width: number, height: number): HistData {
    const padL = 38, padR = 10, padT = 10, padB = 24;
    const w = width - padL - padR, h = height - padT - padB;
    const max = Math.max(...data) * 1.1;
    const bw = w / data.length * 0.86, gap = w / data.length * 0.14;
    const labels = ['0', '.5s', '1s', '1.5s', '2s', '2.5s', '3s', '3.5s', '4s', '5s+'];
    const rects = data.map((v, i) => ({
      x: padL + i * (bw + gap) + gap / 2, w: bw,
      y: padT + h - (v / max) * h, h: (v / max) * h,
      label: labels[i], labelX: padL + i * (bw + gap) + gap / 2 + bw / 2,
    }));
    const barsPath = rects.map(r =>
      `M ${r.x.toFixed(1)} ${r.y.toFixed(1)} h ${r.w.toFixed(1)} v ${r.h.toFixed(1)} h -${r.w.toFixed(1)} Z`
    ).join(' ');
    return { rects, barsPath, baselineY: padT + h };
  }

  private computeStackedBars(
    data: Array<{ d: string; support: number; code: number; triage: number; classify: number }>,
    width: number, height: number,
  ): StackedBarData {
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
      { key: 'support' as const, color: '#8b5cf6' },
      { key: 'code' as const, color: '#06b6d4' },
      { key: 'triage' as const, color: '#10b981' },
      { key: 'classify' as const, color: '#f59e0b' },
    ];
    // Collect path segments per color
    const pathsByColor: Record<string, string[]> = {};
    segsSpec.forEach(s => { pathsByColor[s.color] = []; });

    const bars: BarDay[] = data.map((d, i) => {
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
    const { solidGridPath, dashedGridPath } = this.buildGridPaths(grid, padL, padL + w);
    return { bars, grid, solidGridPath, dashedGridPath, colorPaths, baselineY: padT + h };
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  ngOnInit() {
    this.loadData();
  }

  setVolRange(r: string) {
    this.volRange.set(r);
    this.loadData();
  }

  rangeLabel(): string {
    const r = this.volRange();
    if (r === '1h') return 'Last hour · 5-minute buckets';
    if (r === '24h') return 'Last 24 hours · hourly buckets';
    if (r === '7d') return 'Last 7 days · daily buckets';
    return 'Last 30 days · daily buckets';
  }

  private fromIso(): string {
    const r = this.volRange();
    const now = new Date();
    if (r === '1h') now.setHours(now.getHours() - 1);
    else if (r === '24h') now.setHours(now.getHours() - 24);
    else if (r === '7d') now.setDate(now.getDate() - 7);
    else now.setDate(now.getDate() - 30);
    return now.toISOString();
  }

  private loadData() {
    const from = this.fromIso();
    this.summaryState.set('loading');
    this.recentTracesState.set('loading');
    this.statisticsService.getSummary(from).subscribe({
      next: (data) => { this.summary.set(data); this.summaryState.set('loaded'); },
      error: () => this.summaryState.set('error'),
    });
    this.agentCallsService.getAll({ page: 1, pageSize: 7, from }).subscribe({
      next: (result) => { this.recentTraces.set(result.items); this.recentTracesState.set('loaded'); },
      error: () => this.recentTracesState.set('error'),
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  formatLatency(ms: number): string {
    return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return d.toLocaleDateString();
  }

  truncateId(id: string): string {
    return id.substring(0, 13) + '…';
  }

  statusColor(status: number): string {
    if (status === 200) return 'var(--success)';
    if (status >= 400 && status < 500) return 'var(--warn)';
    return 'var(--danger)';
  }

  modelPillColor(model: string): string {
    const m: Record<string, string> = {
      'gpt-4o': '#8b5cf6', 'gpt-4o-mini': '#06b6d4',
      'gpt-3.5-turbo': '#f59e0b', 'claude-3.5-sonnet': '#10b981',
    };
    return m[model] ?? '#888888';
  }

  formatTokensK(n: number): string {
    return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n);
  }
}
