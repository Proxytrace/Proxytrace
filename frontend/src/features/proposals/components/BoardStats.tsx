import { useLingui } from '@lingui/react/macro';
import { cn } from '../../../lib/cn';
import type { BoardStats as BoardStatsData } from '../theoryBoard';

interface Props {
  stats: BoardStatsData;
}

export function BoardStats({ stats }: Props) {
  const { t } = useLingui();
  const items: { label: string; value: string; tone: 'primary' | 'success' }[] = [
    { label: t`Theories`, value: String(stats.theories), tone: 'primary' },
    { label: t`Tested`, value: String(stats.tested), tone: 'primary' },
    { label: t`Win rate`, value: stats.winRate != null ? `${stats.winRate}%` : '—', tone: 'success' },
    { label: t`Proven gain`, value: stats.provenGainPt > 0 ? `+${stats.provenGainPt}pt` : '0pt', tone: 'success' },
  ];

  return (
    <div
      className="flex items-stretch gap-5 rounded-lg bg-card px-5 py-3 shadow-[var(--shadow-card)] shrink-0"
      data-testid="theory-board-stats"
    >
      {items.map((item, i) => (
        <div key={item.label} className={cn('flex flex-col items-center', i > 0 && 'border-l border-hairline pl-5')}>
          <span className={cn('mono text-h1 font-bold leading-none', item.tone === 'success' ? 'text-success' : 'text-primary')}>
            {item.value}
          </span>
          <span className="text-caption text-muted mt-1">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
