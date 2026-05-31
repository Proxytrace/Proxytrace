import { sparklinePath, areaPath, normalizeToFit } from '../../../../lib/charts';
import type { ChartArtifact as ChartArtifactData } from '../../tracey-artifacts';
import { EmptyState } from '../../../../components/ui/EmptyState';

const W = 560;
const H = 240;
const PAD = { left: 12, right: 12, top: 16, bottom: 32 };
const INNER_W = W - PAD.left - PAD.right;
const INNER_H = H - PAD.top - PAD.bottom;

const ACCENT = 'var(--accent-primary)';

/** Dependency-free SVG chart built on lib/charts.ts helpers. */
export function ChartArtifact({ artifact }: { artifact: ChartArtifactData }) {
  const { points, chartType } = artifact;
  if (points.length === 0) {
    return <EmptyState title="No data" description="Tracey produced an empty chart." />;
  }

  const values = points.map(p => p.value);
  const max = Math.max(...values, 0);
  const labelStep = Math.ceil(points.length / 8);

  return (
    <div className="flex flex-col gap-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={artifact.title}>
        {/* baseline */}
        <line
          x1={PAD.left}
          y1={PAD.top + INNER_H}
          x2={PAD.left + INNER_W}
          y2={PAD.top + INNER_H}
          stroke="var(--border-color)"
          strokeWidth={1}
        />
        <g transform={`translate(${PAD.left} ${PAD.top})`}>
          {chartType === 'bar'
            ? renderBars(values, points.map(p => p.label))
            : renderLine(values, chartType === 'area')}
        </g>
        {/* x-axis labels */}
        {points.map((p, i) =>
          i % labelStep === 0 ? (
            <text
              key={i}
              x={PAD.left + ((i + 0.5) / points.length) * INNER_W}
              y={H - 12}
              textAnchor="middle"
              className="fill-[var(--text-muted)] text-[9px] font-mono"
            >
              {truncate(p.label)}
            </text>
          ) : null,
        )}
        {/* max value */}
        <text x={PAD.left} y={11} className="fill-[var(--text-muted)] text-[9px] font-mono">
          max {formatNum(max)}
        </text>
      </svg>
    </div>
  );
}

function renderBars(values: number[], labels: string[]) {
  const heights = normalizeToFit(values, INNER_H);
  const slot = INNER_W / values.length;
  const barW = slot * 0.62;
  return values.map((v, i) => {
    const h = heights[i];
    const x = i * slot + (slot - barW) / 2;
    return (
      <rect
        key={i}
        x={x}
        y={INNER_H - h}
        width={barW}
        height={Math.max(h, 0)}
        rx={2}
        fill={ACCENT}
        opacity={0.85}
      >
        <title>{`${labels[i]}: ${formatNum(v)}`}</title>
      </rect>
    );
  });
}

function renderLine(values: number[], area: boolean) {
  if (values.length < 2) {
    // A single point: draw a dot.
    const max = Math.max(...values, 1);
    const y = INNER_H - (values[0] / max) * INNER_H;
    return <circle cx={0} cy={y} r={3} fill={ACCENT} />;
  }
  return (
    <>
      {area && (
        <path d={areaPath(values, INNER_W, INNER_H)} fill={ACCENT} opacity={0.14} stroke="none" />
      )}
      <path
        d={sparklinePath(values, INNER_W, INNER_H)}
        fill="none"
        stroke={ACCENT}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </>
  );
}

function truncate(s: string): string {
  return s.length > 10 ? `${s.slice(0, 9)}…` : s;
}

function formatNum(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${Math.round(n * 100) / 100}`;
}
