export interface GridLine { y: number; val: string; isDashed: boolean; }
export interface AreaPoint { x: number; y: number; v: number; }
export interface AreaChartData {
  linePath: string; areaPath: string;
  solidGridPath: string; dashedGridPath: string;
  grid: GridLine[];
  xLabels: { x: number; label: string }[];
  endX: number; endY: number;
  pts: AreaPoint[];
  plotL: number; plotR: number; plotT: number; plotB: number;
}
export interface SparklineData { path: string; endX: number; endY: number; }
export interface HistRect { x: number; y: number; w: number; h: number; label: string; labelX: number; value: number; fullLabel: string; }
export interface HistData { rects: HistRect[]; barsPath: string; baselineY: number; }

export function computeSparkline(data: number[], width: number, height: number): SparklineData {
  if (data.length < 2) return { path: '', endX: 0, endY: 0 };
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const pts = data.map((v, i) => [i * stepX, height - ((v - min) / range) * height]);
  const path = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return { path, endX: pts[pts.length - 1][0], endY: pts[pts.length - 1][1] };
}

export function buildGridPaths(grid: GridLine[], x1: number, x2: number) {
  const solid = grid.filter(g => !g.isDashed).map(g => `M ${x1} ${g.y.toFixed(1)} L ${x2} ${g.y.toFixed(1)}`).join(' ');
  const dashed = grid.filter(g => g.isDashed).map(g => `M ${x1} ${g.y.toFixed(1)} L ${x2} ${g.y.toFixed(1)}`).join(' ');
  return { solidGridPath: solid, dashedGridPath: dashed };
}

export function computeAreaChart(
  data: number[], width: number, height: number,
  padL: number, padR: number, padT: number, padB: number,
  showAxis: boolean,
  xLabelFn?: (i: number, n: number) => string | null,
): AreaChartData {
  if (data.length < 2) {
    return {
      linePath: '', areaPath: '',
      solidGridPath: '', dashedGridPath: '',
      grid: [], xLabels: [], endX: 0, endY: 0,
      pts: [], plotL: padL, plotR: width - padR, plotT: padT, plotB: height - padB,
    };
  }
  const w = width - padL - padR, h = height - padT - padB;
  const max = Math.max(...data) * 1.15 || 1;
  const stepX = w / (data.length - 1);
  const pts = data.map((v, i) => [padL + i * stepX, padT + h - (v / max) * h]);
  const ptsTyped: AreaPoint[] = data.map((v, i) => ({ x: pts[i][0], y: pts[i][1], v }));
  const linePts = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const areaPath = `${linePts} L ${(padL + w).toFixed(1)} ${(padT + h).toFixed(1)} L ${padL} ${(padT + h).toFixed(1)} Z`;
  const yTicks = 4;
  const grid: GridLine[] = showAxis ? Array.from({ length: yTicks }, (_, i) => ({
    y: padT + (i / (yTicks - 1)) * h,
    val: String(Math.round(max * (1 - i / (yTicks - 1)))),
    isDashed: i !== yTicks - 1,
  })) : [];
  const xLabels: { x: number; label: string }[] = [];
  if (showAxis) {
    if (xLabelFn) {
      for (let i = 0; i < data.length; i++) {
        const lbl = xLabelFn(i, data.length);
        if (lbl !== null) xLabels.push({ x: padL + i * stepX, label: lbl });
      }
    } else {
      [0, 6, 12, 18, 23].forEach(i => xLabels.push({ x: padL + i * stepX, label: `${24 - i}h` }));
    }
  }
  const { solidGridPath, dashedGridPath } = buildGridPaths(grid, padL, padL + w);
  return {
    linePath: linePts, areaPath, solidGridPath, dashedGridPath, grid, xLabels,
    endX: pts[pts.length - 1][0], endY: pts[pts.length - 1][1],
    pts: ptsTyped,
    plotL: padL, plotR: padL + w, plotT: padT, plotB: padT + h,
  };
}

export function computeHistogram(
  data: number[],
  width: number,
  height: number,
  labels?: string[],
): HistData {
  const padL = 38, padR = 10, padT = 10, padB = 24;
  const w = width - padL - padR, h = height - padT - padB;
  const max = Math.max(...data, 0) * 1.1 || 1;
  const bw = w / data.length * 0.86, gap = w / data.length * 0.14;
  const fallback = ['0', '.5s', '1s', '1.5s', '2s', '2.5s', '3s', '3.5s', '4s', '5s+'];
  const lab = labels ?? fallback;
  const rects: HistRect[] = data.map((v, i) => ({
    x: padL + i * (bw + gap) + gap / 2, w: bw,
    y: padT + h - (v / max) * h, h: (v / max) * h,
    label: lab[i] ?? '', labelX: padL + i * (bw + gap) + gap / 2 + bw / 2,
    value: v, fullLabel: lab[i] ?? '',
  }));
  const barsPath = rects.map(r =>
    `M ${r.x.toFixed(1)} ${r.y.toFixed(1)} h ${r.w.toFixed(1)} v ${r.h.toFixed(1)} h -${r.w.toFixed(1)} Z`
  ).join(' ');
  return { rects, barsPath, baselineY: padT + h };
}

export function computeModelBars(
  data: { label: string; value: number }[],
  width: number,
  height: number,
  truncateAt = 10,
): HistData {
  if (data.length === 0) return { rects: [], barsPath: '', baselineY: height - 36 };
  const padL = 38, padR = 10, padT = 10, padB = 36;
  const w = width - padL - padR, h = height - padT - padB;
  const max = Math.max(...data.map(d => d.value)) * 1.1 || 1;
  const bw = w / data.length * 0.7, gap = w / data.length * 0.3;
  const rects: HistRect[] = data.map((d, i) => ({
    x: padL + i * (bw + gap) + gap / 2, w: bw,
    y: padT + h - (d.value / max) * h, h: (d.value / max) * h,
    label: d.label.length > truncateAt ? d.label.slice(0, truncateAt - 1) + '…' : d.label,
    labelX: padL + i * (bw + gap) + gap / 2 + bw / 2,
    value: d.value, fullLabel: d.label,
  }));
  const barsPath = rects.map(r =>
    `M ${r.x.toFixed(1)} ${r.y.toFixed(1)} h ${r.w.toFixed(1)} v ${r.h.toFixed(1)} h -${r.w.toFixed(1)} Z`
  ).join(' ');
  return { rects, barsPath, baselineY: padT + h };
}
