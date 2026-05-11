import { Badge } from './Badge';

interface PillProps {
  label: string;
  color: string;
  size?: 'sm' | 'md';
  onClick?: () => void;
  selected?: boolean;
}

export function Pill({ label, color, size = 'md', onClick, selected }: PillProps) {
  return (
    <Badge
      label={label}
      variant="tinted"
      color={color}
      shape="pill"
      size={size}
      onClick={onClick}
      selected={selected}
    />
  );
}
