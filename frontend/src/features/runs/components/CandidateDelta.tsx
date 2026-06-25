import { Trans, useLingui } from '@lingui/react/macro';
import type { LeaderboardEntry } from '../comparison';
import { TestRunStatus } from '../../../api/models';
import { fmtDuration, fmtCost } from '../../../lib/format';
import { cn } from '../../../lib/cn';
import { Card } from '../../../components/ui/Card';
import { Spinner } from '../../../components/ui/Spinner';
import { ModelTag } from './ModelTag';
import { ComparisonTag } from './ComparisonTag';
import { MetricDeltaBadge } from './MetricDeltaBadge';

/**
 * A candidate model card: identifies the model and reads each headline metric (pass rate, speed,
 * cost) as a signed delta vs the baseline. Deltas resolve only once the whole group settles — while
 * a run is in flight the card shows the live values without conclusions.
 */
export function CandidateDelta({ entry, baselineIsProduction }: { entry: LeaderboardEntry; baselineIsProduction: boolean }) {
  const { t } = useLingui();
  const { run, passRate, passed, failed, delta } = entry;
  const running = run.status === TestRunStatus.Running;
  const pending = run.status === TestRunStatus.Pending;
  const total = passed + failed || run.totalCases;

  const points = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '±0');
  const costText = (frac: number) => {
    const pct = Math.round(Math.abs(frac) * 100);
    if (pct === 0) return t`same`;
    return frac > 0 ? t`${pct}% cheaper` : t`${pct}% pricier`;
  };
  const speedText = (ms: number) => (ms === 0 ? t`same` : ms > 0 ? t`${fmtDuration(ms)} faster` : t`${fmtDuration(-ms)} slower`);

  const rows = [
    {
      label: t`Pass rate`,
      value: passRate === null ? '—' : t`${passRate}% · ${passed}/${total} pass`,
      badge: delta?.passPoints != null ? { better: delta.passBetter, text: t`${points(delta.passPoints)} pt` } : null,
    },
    {
      label: t`Speed`,
      value: fmtDuration(run.durationMs),
      badge: delta?.durationMs != null ? { better: delta.durationBetter, text: speedText(delta.durationMs) } : null,
    },
    {
      label: t`Cost`,
      value: fmtCost(entry.costUsd),
      badge: delta?.costFraction != null ? { better: delta.costBetter, text: costText(delta.costFraction) } : null,
    },
  ];

  return (
    <Card padding="md" data-testid={`model-candidate-${run.endpointId}`} className="h-full">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
        <ModelTag name={run.endpointName} />
        <ComparisonTag variant="candidate" />
      </div>

      <div className="flex items-center gap-1.5 text-body-sm text-muted min-h-[18px]">
        {delta
          ? (baselineIsProduction ? <Trans>vs production</Trans> : <Trans>vs baseline</Trans>)
          : running
            ? <><Trans>running…</Trans><Spinner size={12} color="var(--text-muted)" /></>
            : pending
              ? <Trans>pending</Trans>
              : null}
      </div>

      <div className="mt-1.5">
        {rows.map((r, i) => (
          <div key={r.label} className={cn('flex items-center justify-between gap-2 py-2.5', i < rows.length - 1 && 'border-b border-hairline')}>
            <div className="min-w-0">
              <div className="text-body font-semibold text-primary">{r.label}</div>
              <div className="mono text-caption text-muted mt-0.5 truncate" title={r.value}>{r.value}</div>
            </div>
            {r.badge ? <MetricDeltaBadge better={r.badge.better}>{r.badge.text}</MetricDeltaBadge> : <span className="text-caption text-muted">—</span>}
          </div>
        ))}
      </div>
    </Card>
  );
}
