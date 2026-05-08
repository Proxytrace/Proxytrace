import { useMemo } from 'react';
import { computeAreaChart } from './chart-math';

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
}: AreaChartProps) {
  const padL = padding?.l ?? (showAxis ? 38 : 4);
  const padR = padding?.r ?? (showAxis ? 10 : 4);
  const padT = padding?.t ?? (showAxis ? 14 : 4);
  const padB = padding?.b ?? (showAxis ? 24 : 4);

  const chart = useMemo(
    () => computeAreaChart(data, width, height, padL, padR, padT, padB, showAxis, xLabelFn),
    [data, width, height, padL, padR, padT, padB, showAxis, xLabelFn],
  );

  if (data.length < 2) return null;

  return (
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
      {showEndMarker && (
        <>
          <circle cx={chart.endX} cy={chart.endY} r="8" fill={color} opacity="0.15" />
          <circle cx={chart.endX} cy={chart.endY} r="4" fill={color} />
          <circle cx={chart.endX} cy={chart.endY} r="2" fill="var(--bg-card)" />
        </>
      )}
      {showAxis && chart.xLabels.map((l, i) => (
        <text key={i} x={l.x} y={height - 6} textAnchor="middle" fill="#67645e" fontSize="10" fontFamily="JetBrains Mono, monospace">{l.label}</text>
      ))}
    </svg>
  );
}
