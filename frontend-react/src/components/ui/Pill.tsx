interface PillProps {
  label: string;
  color: string;
  size?: 'sm' | 'md';
  onClick?: () => void;
  selected?: boolean;
}

export function Pill({ label, color, size = 'md', onClick, selected }: PillProps) {
  const pad = size === 'sm' ? '2px 6px' : '3px 8px';
  const fs = size === 'sm' ? '10px' : '11px';

  return (
    <span
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center',
        padding: pad, borderRadius: '100px',
        fontSize: fs, fontWeight: 600, letterSpacing: '0.02em',
        background: `${color}22`,
        color,
        border: `1px solid ${color}44`,
        boxShadow: 'var(--shadow-pill)',
        cursor: onClick ? 'pointer' : 'default',
        outline: selected ? `2px solid ${color}` : 'none',
        outlineOffset: '1px',
        transition: 'opacity 0.15s',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}
