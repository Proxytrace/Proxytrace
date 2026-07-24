import { Badge } from './Badge';

interface ColoredBadgeProps {
  color: string;
  label: React.ReactNode;
  size?: 'sm' | 'md';
  dot?: boolean;
}

export function ColoredBadge({ color, label, size = 'sm', dot = false }: ColoredBadgeProps) {
  return <Badge label={label} variant="tinted" color={color} size={size} dot={dot} />;
}
