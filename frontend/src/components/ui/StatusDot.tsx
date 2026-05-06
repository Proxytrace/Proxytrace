import { statusColor } from '../../lib/colors';

interface StatusDotProps {
  httpStatus: number;
  showLabel?: boolean;
}

export function StatusDot({ httpStatus, showLabel = true }: StatusDotProps) {
  const color = statusColor(httpStatus);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span style={{ background: color }} className="size-[7px] rounded-full shrink-0" />
      {showLabel && <span style={{ color }} className="text-xs font-semibold">{httpStatus}</span>}
    </span>
  );
}
