import { Trans, useLingui } from '@lingui/react/macro';
import type { LeaderboardEntry } from '../comparison';
import { passRateColor } from '../results';
import { TestRunStatus } from '../../../api/models';
import { fmtDuration, fmtCost, fmtTokens, cachedPct } from '../../../lib/format';
import { cn } from '../../../lib/cn';
import { Card } from '../../../components/ui/Card';
import { Spinner } from '../../../components/ui/Spinner';
import { ModelTag } from './ModelTag';
import { ComparisonTag } from './ComparisonTag';

/**
 * The baseline card — the in-production model (or, when the group has no deployed model, the best
 * performer). It carries the hero pass rate and the run's headline duration / cost / token totals;
 * candidate cards read against it. The success ring marks it as the bar to beat.
 */
export function ChampionPanel({ entry }: { entry: LeaderboardEntry }) {
  const { t } = useLingui();
  const { run, passRate, passed, failed } = entry;
  const running = run.status === TestRunStatus.Running;
  const pending = run.status === TestRunStatus.Pending;

  const tokens = entry.tokensIn != null
    ? (() => {
        const tok = `${fmtTokens(entry.tokensIn)}/${fmtTokens(entry.tokensOut ?? 0)}`;
        const cached = cachedPct(entry.cachedTokensIn ?? 0, entry.tokensIn);
        return cached !== null ? t`${tok} · ${cached}% cached` : tok;
      })()
    : '—';

  return (
    <Card
      padding="md"
      data-testid={`model-champion-${run.endpointId}`}
      className={cn(
        'h-full border border-[color-mix(in_srgb,var(--success)_38%,transparent)]',
        'shadow-[0_0_0_1px_color-mix(in_srgb,var(--success)_12%,transparent),var(--shadow-card)]',
      )}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
        <div className="flex flex-col gap-0.5 min-w-0">
          <ModelTag name={run.endpointName} />
          {entry.sampleCount > 1 && (
            <span className="text-caption text-muted"><Trans>avg of {entry.sampleCount} samples</Trans></span>
          )}
        </div>
        <ComparisonTag variant={entry.isProduction ? 'production' : 'baseline'} />
      </div>

      <div className="flex items-baseline gap-2">
        <span className="mono text-display font-bold tracking-[-0.02em] leading-none" style={{ color: passRateColor(passRate) }}>
          {passRate === null ? '—' : passRate}
        </span>
        <span className="text-h2 text-muted font-medium">%</span>
        <span className="text-body-sm text-muted ml-1"><Trans>pass rate</Trans></span>
        {running && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-body-sm text-accent font-semibold">
            <Spinner size={12} color="var(--accent-primary)" /> <Trans>running</Trans>
          </span>
        )}
      </div>

      <div className="flex gap-3 mt-2.5 mono text-body-sm">
        <span className="text-success font-semibold">{passed}<span className="text-muted font-normal"> <Trans>pass</Trans></span></span>
        <span className="text-danger font-semibold">{failed}<span className="text-muted font-normal"> <Trans>fail</Trans></span></span>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-4 pt-3.5 border-t border-hairline">
        <Stat label={t`Duration`} value={pending ? '—' : fmtDuration(run.durationMs)} />
        <Stat label={t`Cost`} value={fmtCost(entry.costUsd)} />
        <Stat label={t`Tokens`} value={tokens} />
      </div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-caption font-semibold text-muted tracking-[0.06em] uppercase mb-0.5">{label}</div>
      <div className="mono text-body-sm font-semibold text-secondary truncate" title={value}>{value}</div>
    </div>
  );
}
