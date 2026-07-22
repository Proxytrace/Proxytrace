import type { ReactNode } from 'react';
import { Trans } from '@lingui/react/macro';
import type { LeaderboardEntry } from '../comparison';
import { modelColor } from '../../../lib/colors';
import { fmtDuration, fmtCost } from '../../../lib/format';
import { TargetIcon, ZapIcon, CoinsIcon } from '../../../components/icons';
import { Card } from '../../../components/ui/Card';

interface Medal { key: string; icon: ReactNode; label: ReactNode; entry: LeaderboardEntry; value: string; }

/**
 * The three award medals — highest pass rate, fastest, cheapest — each naming the winning model in
 * its own color. Only rendered for a settled multi-model group; a medal is dropped if its metric has
 * no winner (e.g. cost unavailable).
 */
export function MedalsRow({ entries }: { entries: LeaderboardEntry[] }) {
  const best = entries.find(e => e.isBest);
  const fastest = entries.find(e => e.isFastest);
  const cheapest = entries.find(e => e.isCheapest);

  const medals: Medal[] = [];
  if (best?.passRate != null) medals.push({ key: 'best', icon: <TargetIcon size={15} />, label: <Trans>Highest pass rate</Trans>, entry: best, value: `${best.passRate}%` });
  if (fastest) medals.push({ key: 'fast', icon: <ZapIcon size={15} />, label: <Trans>Fastest</Trans>, entry: fastest, value: fmtDuration(fastest.durationMs) });
  if (cheapest) medals.push({ key: 'cheap', icon: <CoinsIcon size={15} />, label: <Trans>Cheapest</Trans>, entry: cheapest, value: fmtCost(cheapest.costEur) });
  if (medals.length === 0) return null;

  return (
    <Card padding="md" data-testid="model-medals" className="mt-3 grid grid-cols-1 @xl:grid-cols-3 gap-x-6 gap-y-3">
      {medals.map(m => {
        const c = modelColor(m.entry.run.endpointName);
        return (
          <div key={m.key} className="flex items-center gap-3 min-w-0">
            <span
              aria-hidden
              className="w-8 h-8 rounded-md grid place-items-center shrink-0 border"
              style={{ color: c, background: `color-mix(in srgb, ${c} 16%, transparent)`, borderColor: `color-mix(in srgb, ${c} 35%, transparent)` }}
            >
              {m.icon}
            </span>
            <div className="min-w-0">
              <div className="text-caption font-bold uppercase tracking-[0.06em] text-secondary">{m.label}</div>
              <div className="flex items-baseline gap-2 mt-0.5 min-w-0">
                <span className="mono text-body-sm font-bold truncate" style={{ color: c }}>{m.entry.run.endpointName}</span>
                <span className="mono text-body-sm text-secondary shrink-0">{m.value}</span>
              </div>
            </div>
          </div>
        );
      })}
    </Card>
  );
}
