import { sparklinePath } from '../../lib/charts';

interface SparklineProps {
  data: number[];
  color: string;
  width?: number;
  height?: number;
  strokeWidth?: number;
  opacity?: number;
}

export function Sparkline({
  data,
  color,
  width = 80,
  height = 36,
  strokeWidth = 1.5,
  opacity = 0.8,
}: SparklineProps) {
  if (data.length < 2) return null;
  return (
    <svg width={width} height={height} className="shrink-0">
      <path
        d={sparklinePath(data, width, height)}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={opacity}
      />
    </svg>
  );
}
