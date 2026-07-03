import { useMemo } from 'react';
import { useLingui } from '@lingui/react/macro';
import { Skeleton } from '../../../components/ui/Skeleton';
import { AlertTriangleIcon, SigmaIcon, SparklesIcon, UsersIcon } from '../../../components/icons';
import type { AgentAnomalyStatDto } from '../../../api/models';
import { summarizeWindow } from '../anomaliesMeta';

interface Props {
  rows: AgentAnomalyStatDto[];
  isLoading: boolean;
}

/** Compact bento stat tiles for the stats column: window totals split by flag source, plus how many
 * agents are affected. Derived from the timeline rows — no extra query. */
export function AnomalyKpis({ rows, isLoading }: Props) {
  const { t } = useLingui();
  const summary = useMemo(() => summarizeWindow(rows), [rows]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4" data-testid="anomaly-kpis-loading">
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} height={64} className="rounded-lg" />)}
      </div>
    );
  }

  const tiles = [
    { key: 'total', icon: <AlertTriangleIcon size={13} />, label: t`Flagged calls`, value: summary.total },
    { key: 'static', icon: <SigmaIcon size={13} />, label: t`Statistical flags`, value: summary.staticTotal },
    { key: 'custom', icon: <SparklesIcon size={13} />, label: t`Detector flags`, value: summary.customTotal },
    { key: 'agents', icon: <UsersIcon size={13} />, label: t`Agents affected`, value: summary.agentCount },
  ];

  return (
    <div className="grid grid-cols-2 gap-4" data-testid="anomaly-kpis">
      {tiles.map(tile => (
        <div key={tile.key} className="bg-card rounded-lg shadow-[var(--shadow-card)] p-3 flex flex-col gap-1 min-w-0">
          <span className="flex items-center gap-1.5 text-caption text-muted min-w-0">
            <span className="shrink-0 text-secondary">{tile.icon}</span>
            <span className="truncate">{tile.label}</span>
          </span>
          <span className="mono text-h1 font-semibold text-primary leading-none">{tile.value}</span>
        </div>
      ))}
    </div>
  );
}
