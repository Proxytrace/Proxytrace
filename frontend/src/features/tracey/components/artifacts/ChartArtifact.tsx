import { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { EmptyState } from '../../../../components/ui/EmptyState';
import type { ChartArtifact as ChartArtifactData } from '../../tracey-artifacts';
import {
  CHART_H,
  CHART_W,
  INNER_W,
  PAD_LEFT,
  PAD_TOP,
  buildScale,
  formatNum,
  ticks,
} from './chart-geometry';
import { ChartSeries } from './ChartSeries';
import { ChartTooltip } from './ChartTooltip';

/** A labelled summary statistic shown in the strip above the plot. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-caption uppercase tracking-[0.06em] text-secondary">{label}</span>
      <span className="font-mono text-title font-semibold tabular-nums text-primary">{value}</span>
    </div>
  );
}

/** Dependency-free, interactive SVG chart built on chart-geometry.ts. Hover a column for details. */
export function ChartArtifact({ artifact }: { artifact: ChartArtifactData }) {
  const { t } = useLingui();
  const { points, chartType } = artifact;
  const [hover, setHover] = useState<number | null>(null);

  if (points.length === 0) {
    return <EmptyState title={t`No data`} description={t`Tracey produced an empty chart.`} />;
  }

  const values = points.map((p) => p.value);
  const scale = buildScale(values);
  const gridlines = ticks(scale);
  const labelStep = Math.ceil(points.length / 8);
  const sum = values.reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Stat label={t`Max`} value={formatNum(Math.max(...values))} />
        <Stat label={t`Min`} value={formatNum(Math.min(...values))} />
        <Stat label={t`Avg`} value={formatNum(sum / values.length)} />
        <Stat label={t`Last`} value={formatNum(values[values.length - 1])} />
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          className="h-auto w-full overflow-visible"
          role="img"
          aria-label={artifact.title}
        >
          {/* Horizontal gridlines + y-axis tick labels. */}
          {gridlines.map((t, i) => (
            <g key={i}>
              <line
                x1={PAD_LEFT}
                y1={t.y}
                x2={PAD_LEFT + INNER_W}
                y2={t.y}
                stroke="var(--border-color)"
                strokeWidth={1}
                opacity={i === 0 ? 1 : 0.4}
              />
              <text
                x={PAD_LEFT - 8}
                y={t.y + 3}
                textAnchor="end"
                className="fill-[var(--text-muted)] font-mono text-caption"
              >
                {formatNum(t.value)}
              </text>
            </g>
          ))}

          <ChartSeries values={values} chartType={chartType} scale={scale} hover={hover} />

          {/* X-axis labels (thinned to avoid overlap). */}
          {points.map((p, i) =>
            i % labelStep === 0 ? (
              <text
                key={i}
                x={scale.xCenter(i)}
                y={CHART_H - 10}
                textAnchor="middle"
                className="fill-[var(--text-muted)] font-mono text-caption"
              >
                {truncate(p.label)}
              </text>
            ) : null,
          )}

          {/* Transparent hit areas drive the hover state per category. */}
          {points.map((_, i) => {
            const slot = scale.slot(points.length);
            return (
              <rect
                key={i}
                x={scale.xCenter(i) - slot / 2}
                y={PAD_TOP}
                width={slot}
                height={CHART_H - PAD_TOP}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover((h) => (h === i ? null : h))}
              />
            );
          })}
        </svg>

        {hover !== null && (
          <ChartTooltip
            label={points[hover].label}
            value={formatNum(values[hover])}
            leftPct={(scale.xCenter(hover) / CHART_W) * 100}
            topPct={(scale.y(values[hover]) / CHART_H) * 100}
          />
        )}
      </div>

      {/* Screen-reader-only data table: the hover tooltip is mouse-only, so expose the same
          numbers as a table for assistive tech (DESIGN §7 — color/visual is never the only signal). */}
      <table className="sr-only">
        <caption>{artifact.title}</caption>
        <thead>
          <tr>
            <th scope="col"><Trans>Label</Trans></th>
            <th scope="col"><Trans>Value</Trans></th>
          </tr>
        </thead>
        <tbody>
          {points.map((p, i) => (
            <tr key={i}>
              <td>{p.label}</td>
              <td>{p.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function truncate(s: string): string {
  return s.length > 10 ? `${s.slice(0, 9)}…` : s;
}
