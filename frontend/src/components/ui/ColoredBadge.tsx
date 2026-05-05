interface ColoredBadgeProps {
  color: string;
  label: React.ReactNode;
  shape?: 'pill' | 'rounded';
  size?: 'sm' | 'md';
  dot?: boolean;
}

export function ColoredBadge({ color, label, shape = 'pill', size = 'sm', dot = false }: ColoredBadgeProps) {
  const sizeClass = size === 'sm'
    ? 'px-2 py-[2px] text-[10.5px]'
    : 'px-[9px] py-[3px] text-[11px]';
  const shapeClass = shape === 'pill' ? 'rounded-full' : 'rounded-[5px]';
  return (
    <span
      className={`inline-flex items-center gap-[5px] font-semibold ${sizeClass} ${shapeClass}`}
      style={{ background: `${color}1f`, color, border: `1px solid ${color}33` }}
    >
      {dot && <span className="w-[5px] h-[5px] rounded-full shrink-0" style={{ background: color }} />}
      {label}
    </span>
  );
}
