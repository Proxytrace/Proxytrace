import { cn } from '../../../lib/cn';
import { modelColor } from '../../../lib/colors';

/** Model endpoint name with its color chip — shared by the leaderboard, heatmap and matrix. */
export function ModelTag({ name, size = 'sm', className }: {
  name: string;
  size?: 'sm' | 'xs';
  className?: string;
}) {
  const c = modelColor(name);
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 mono font-semibold min-w-0', size === 'xs' ? 'text-caption' : 'text-body-sm', className)}
      style={{ color: c }}
    >
      <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: c }} />
      <span className="truncate">{name}</span>
    </span>
  );
}
