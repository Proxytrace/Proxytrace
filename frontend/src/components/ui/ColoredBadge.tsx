import { Badge } from './Badge';

interface ColoredBadgeProps {
  color: string;
  label: React.ReactNode;
  shape?: 'pill' | 'rounded';
  size?: 'sm' | 'md';
  dot?: boolean;
}

export function ColoredBadge({ color, label, shape = 'pill', size = 'sm', dot = false }: ColoredBadgeProps) {
  return <Badge label={label} variant="tinted" color={color} shape={shape} size={size} dot={dot} />;
}
