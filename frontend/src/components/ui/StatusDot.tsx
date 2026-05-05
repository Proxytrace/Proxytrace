import { statusColor } from '../../lib/colors';

interface StatusDotProps {
  httpStatus: number;
  showLabel?: boolean;
}

export function StatusDot({ httpStatus, showLabel = true }: StatusDotProps) {
  const color = statusColor(httpStatus);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: color, flexShrink: 0 }} />
      {showLabel && <span style={{ color, fontSize: '12px', fontWeight: 600 }}>{httpStatus}</span>}
    </span>
  );
}
