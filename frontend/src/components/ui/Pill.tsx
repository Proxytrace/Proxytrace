interface PillProps {
  label: string;
  color: string;
  size?: 'sm' | 'md';
  onClick?: () => void;
  selected?: boolean;
}

export function Pill({ label, color, size = 'md', onClick, selected }: PillProps) {
  return (
    <span
      onClick={onClick}
      style={{
        padding: size === 'sm' ? '2px 6px' : '3px 8px',
        fontSize: size === 'sm' ? '10px' : '11px',
        background: `${color}22`,
        color,
        border: `1px solid ${color}44`,
        boxShadow: 'var(--shadow-pill)',
        cursor: onClick ? 'pointer' : 'default',
        outline: selected ? `2px solid ${color}` : 'none',
        outlineOffset: '1px',
      }}
      className="inline-flex items-center rounded-full font-semibold tracking-[0.02em] transition-opacity whitespace-nowrap"
    >
      {label}
    </span>
  );
}
