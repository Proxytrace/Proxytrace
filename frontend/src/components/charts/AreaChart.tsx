import { useMemo, useRef, useState } from 'react';
import { computeAreaChart } from './chart-math';
import { ChartTooltip } from './ChartTooltip';

interface AreaChartProps {
  data: number[];
  width?: number;
  height?: number;
  color: string;
  gradientId: string;
  padding?: { l?: number; r?: number; t?: number; b?: number };
  showAxis?: boolean;
  showEndMarker?: boolean;
  xLabelFn?: (i: number, n: number) => string | null;
  formatValue?: (v: number) => string;
  tooltipLabelFn?: (i: number) => string;
}

export function AreaChart({
  data,
  width = 820,
  height = 240,
  color,
  gradientId,
  padding,
  showAxis = true,
  showEndMarker = true,
  xLabelFn,
  formatValue,
  tooltipLabelFn,
}: AreaChartProps) {
  const padL = padding?.l ?? (showAxis ? 38 : 4);
  const padR = padding?.r ?? (showAxis ? 10 : 4);
  const padT = padding?.t ?? (showAxis ? 14 : 4);
  const padB = padding?.b ?? (showAxis ? 24 : 4);

  const chart = useMemo(
    () => computeAreaChart(data, width, height, padL, padR, padT, padB, showAxis, xLabelFn),
    [data, width, height, padL, padR, padT, padB, showAxis, xLabelFn],
  );

  const wrapRef = useRef<HTMLDivElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (data.length < 2) return null;

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const xPx = e.clientX - rect.left;
    const xVb = (xPx / rect.width) * width;
    const stepX = (width - padL - padR) / (data.length - 1);
    const idx = Math.max(0, Math.min(data.length - 1, Math.round((xVb - padL) / stepX)));
    setHoverIdx(idx);
  };

  const hoverPt = hoverIdx !== null ? chart.pts[hoverIdx] : null;
  const fmt = formatValue ?? ((v: number) => String(v));

  return (
    <div
      ref={wrapRef}
      className="relative"
      onMouseMove={handleMove}
      onMouseLeave={() => setHoverIdx(null)}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        style={{ display: 'block', overflow: 'visible' }}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.30" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {showAxis && (
          <>
            <path d={chart.solidGridPath} stroke="#343438" strokeWidth="1" fill="none" />
            <path d={chart.dashedGridPath} stroke="#343438" strokeWidth="1" strokeDasharray="3 4" fill="none" />
            {chart.grid.map((g, i) => (
              <text key={i} x={padL - 8} y={g.y + 4} textAnchor="end" fill="#67645e" fontSize="10" fontFamily="JetBrains Mono, monospace">{g.val}</text>
            ))}
          </>
        )}
        <path d={chart.areaPath} fill={`url(#${gradientId})`} />
        <path d={chart.linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {showEndMarker && hoverIdx === null && (
          <>
            <circle cx={chart.endX} cy={chart.endY} r="8" fill={color} opacity="0.15" />
            <circle cx={chart.endX} cy={chart.endY} r="4" fill={color} />
            <circle cx={chart.endX} cy={chart.endY} r="2" fill="var(--bg-card)" />
          </>
        )}
        {hoverPt && (
          <>
            <line
              x1={hoverPt.x} x2={hoverPt.x}
              y1={chart.plotT} y2={chart.plotB}
              stroke={color} strokeOpacity="0.4" strokeWidth="1" strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={hoverPt.x} cy={hoverPt.y} r="6" fill={color} opacity="0.2" />
            <circle cx={hoverPt.x} cy={hoverPt.y} r="3.5" fill={color} />
            <circle cx={hoverPt.x} cy={hoverPt.y} r="1.5" fill="var(--bg-card)" />
          </>
        )}
        {showAxis && chart.xLabels.map((l, i) => (
          <text key={i} x={l.x} y={height - 6} textAnchor="middle" fill="#67645e" fontSize="10" fontFamily="JetBrains Mono, monospace">{l.label}</text>
        ))}
      </svg>
      {hoverPt && hoverIdx !== null && (
        <ChartTooltip
          leftPct={(hoverPt.x / width) * 100}
          topPct={(hoverPt.y / height) * 100}
          label={tooltipLabelFn ? tooltipLabelFn(hoverIdx) : undefined}
          value={fmt(hoverPt.v)}
          color={color}
        />
      )}
    </div>
  );
}
