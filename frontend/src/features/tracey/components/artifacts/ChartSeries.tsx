import type { ChartType } from '../../tracey-artifacts';
import type { Scale } from './chart-geometry';

const ACCENT = 'var(--accent-primary)';

interface ChartSeriesProps {
  values: number[];
  chartType: ChartType;
  scale: Scale;
  hover: number | null;
}

/** Draws the data series (bars, line, or area) plus the hover emphasis for the active category. */
export function ChartSeries({ values, chartType, scale, hover }: ChartSeriesProps) {
  if (chartType === 'bar') {
    return <Bars values={values} scale={scale} hover={hover} />;
  }
  return <LineArea values={values} scale={scale} hover={hover} area={chartType === 'area'} />;
}

function Bars({ values, scale, hover }: { values: number[]; scale: Scale; hover: number | null }) {
  const slot = scale.slot(values.length);
  const barW = Math.max(slot * 0.6, 2);
  return (
    <>
      {values.map((v, i) => {
        const top = scale.y(v);
        const x = scale.xCenter(i) - barW / 2;
        const h = Math.max(Math.abs(scale.baselineY - top), 1);
        const active = hover === i;
        return (
          <rect
            key={i}
            x={x}
            y={Math.min(top, scale.baselineY)}
            width={barW}
            height={h}
            rx={3}
            fill={ACCENT}
            className="transition-opacity duration-[var(--motion-fast)]"
            opacity={hover === null || active ? 0.9 : 0.4}
          />
        );
      })}
    </>
  );
}

function LineArea({
  values,
  scale,
  hover,
  area,
}: {
  values: number[];
  scale: Scale;
  hover: number | null;
  area: boolean;
}) {
  if (values.length === 1) {
    return <circle cx={scale.xCenter(0)} cy={scale.y(values[0])} r={3.5} fill={ACCENT} />;
  }
  const pts = values.map((v, i) => `${scale.xCenter(i)},${scale.y(v)}`);
  // eslint-disable-next-line lingui/no-unlocalized-strings -- SVG path command, not UI copy
  const line = `M${pts.join(' L')}`;
  const last = values.length - 1;
  return (
    <>
      {area && (
        <path
          d={`${line} L${scale.xCenter(last)},${scale.baselineY} L${scale.xCenter(0)},${scale.baselineY} Z`}
          fill={ACCENT}
          opacity={0.12}
        />
      )}
      <path
        d={line}
        fill="none"
        stroke={ACCENT}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Endpoint marker + a brighter ring on the hovered point. */}
      <circle cx={scale.xCenter(last)} cy={scale.y(values[last])} r={3} fill={ACCENT} />
      {hover !== null && (
        <>
          <line
            x1={scale.xCenter(hover)}
            y1={scale.y(scale.domainMax)}
            x2={scale.xCenter(hover)}
            y2={scale.y(scale.domainMin)}
            stroke="var(--border-color)"
            strokeDasharray="3 3"
          />
          <circle
            cx={scale.xCenter(hover)}
            cy={scale.y(values[hover])}
            r={4}
            fill="var(--bg-card)"
            stroke={ACCENT}
            strokeWidth={2}
          />
        </>
      )}
    </>
  );
}
