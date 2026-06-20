import type { ReactNode } from 'react';
import { useLingui } from '@lingui/react/macro';

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutProps {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  /** Rendered centered inside the ring (e.g. a total). */
  children?: ReactNode;
}

/**
 * Donut / ring chart. Segments are drawn as dash-offset arcs on a single circle,
 * so no path math is needed. Empty input renders just the track ring.
 */
export function Donut({ segments, size = 132, thickness = 16, children }: DonutProps) {
  const { t } = useLingui();
  const total = segments.reduce((n, s) => n + s.value, 0);
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="block -rotate-90" role="img" aria-label={t`Share by segment`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border-color)" strokeWidth={thickness} />
        {total > 0 &&
          segments.map((s, i) => {
            const len = (s.value / total) * circ;
            const arc = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={thickness}
                strokeDasharray={`${len} ${circ - len}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return arc;
          })}
      </svg>
      {children && <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>}
    </div>
  );
}
