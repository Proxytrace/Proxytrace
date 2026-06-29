// Hero token-volume card with area chart and model split bar.

import { Trans, useLingui } from '@lingui/react/macro';
import { AreaChart } from '../../../components/charts';
import { EmptyState } from '../../../components/ui/EmptyState';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import type { SummaryDto } from '../../../api/models';
import { modelColor } from '../../../lib/colors';
import { fmtTokens } from '../../../lib/format';
import { CachedTokensHint } from '../../../components/ui/CachedTokensHint';
import { bucketAxisLabel, rangeWindowLabel, type RangeKey, type StatisticsBucket } from '../../../lib/time-range';
import { RANGES, splitTokenStr, type ModelSplit } from '../dashboardMeta';

interface HeroTokenCardProps {
  summary: SummaryDto | undefined;
  tokenVolume: number[];
  /** Bucket-start ISO timestamps aligned 1:1 with `tokenVolume`, for the x time axis. */
  tokenBuckets: string[];
  /** Backend-resolved bucket granularity, for axis-label formatting. */
  bucket: StatisticsBucket;
  modelSplit: ModelSplit;
  range: RangeKey;
  onRangeChange: (r: RangeKey) => void;
}

export function HeroTokenCard({ summary, tokenVolume, tokenBuckets, bucket, modelSplit, range, onRangeChange }: HeroTokenCardProps) {
  const { t } = useLingui();
  const totalTokens = (summary?.totalInputTokens ?? 0) + (summary?.totalOutputTokens ?? 0);
  const { num: tokenNum, suffix: tokenSuffix } = splitTokenStr(totalTokens);

  // Time axis: ~5 evenly spaced labels formatted from the bucket timestamps.
  const labelStep = Math.max(1, Math.ceil((tokenBuckets.length - 1) / 4));
  const xLabelFn = (i: number, n: number): string | null =>
    (i % labelStep === 0 || i === n - 1) && tokenBuckets[i] ? bucketAxisLabel(tokenBuckets[i], bucket) : null;
  const tooltipLabelFn = (i: number): string => (tokenBuckets[i] ? bucketAxisLabel(tokenBuckets[i], bucket) : '');

  return (
    <div data-testid="hero-token-card" className="relative overflow-hidden rounded-lg bg-card px-4 pt-3 pb-3.5 flex flex-col gap-2.5 shadow-[var(--shadow-card)]">
      <div className="absolute -top-20 -left-16 w-[420px] h-[280px] pointer-events-none bg-[radial-gradient(ellipse,var(--accent-subtle),transparent_70%)]" />
      <div className="absolute -bottom-24 -right-16 w-[380px] h-[260px] pointer-events-none bg-[radial-gradient(ellipse,color-mix(in_srgb,var(--teal)_6%,transparent),transparent_70%)]" />

      {/* Header: value + range picker */}
      <div className="relative flex items-start justify-between">
        <div>
          <div className="text-caption text-muted tracking-[0.16em] uppercase font-bold font-mono mb-1">
            <Trans>Token Volume · {rangeWindowLabel(range)}</Trans>
          </div>
          <div className="flex items-baseline gap-2.5 flex-wrap">
            {/* display-tier: intentional, outside type scale */}
            <span
              data-testid="hero-token-total"
              data-token-total={totalTokens}
              className="text-[44px] font-extrabold tracking-[-0.04em] leading-[0.92] text-primary tabular-nums"
            >
              {tokenNum}<span className="text-accent">{tokenSuffix}</span>
            </span>
          </div>
          <div className="mt-1.5 flex gap-2.5 text-caption font-mono text-muted items-center flex-wrap">
            <span>
              <Trans><span className="text-secondary font-semibold">{(summary?.totalInputTokens ?? 0).toLocaleString()}</span> in</Trans>
              <CachedTokensHint cachedInput={summary?.totalCachedInputTokens ?? 0} input={summary?.totalInputTokens ?? 0} />
            </span>
            <span className="text-border">/</span>
            <span><Trans><span className="text-secondary font-semibold">{(summary?.totalOutputTokens ?? 0).toLocaleString()}</span> out</Trans></span>
            <span className="text-border">/</span>
            <span><Trans><span className="text-secondary font-semibold">{(summary?.totalCalls ?? 0).toLocaleString()}</span> traces</Trans></span>
          </div>
        </div>
        <SegmentedControl
          value={range}
          onChange={onRangeChange}
          segments={RANGES.map(r => ({ value: r, label: r }))}
        />
      </div>

      {/* Area chart */}
      <div className="relative -mx-2">
        {tokenVolume.length >= 2 ? (
          <AreaChart
            data={tokenVolume}
            height={140}
            color="var(--accent-primary)"
            // eslint-disable-next-line lingui/no-unlocalized-strings -- SVG gradient element id, not UI copy
            gradientId="heroVolGrad"
            showAxis
            xLabelFn={xLabelFn}
            tooltipLabelFn={tooltipLabelFn}
            formatValue={v => t`${fmtTokens(v)} tokens`}
          />
        ) : (
          <div className="h-[140px] flex items-center justify-center">
            <EmptyState title={t`No token data yet`} description={t`Volume appears once traces are captured.`} />
          </div>
        )}
      </div>

      {/* Model split */}
      <div className="relative flex flex-col gap-1.5 pt-2 border-t border-border-subtle">
        <div className="flex items-center justify-between">
          <div className="text-caption text-muted tracking-[0.14em] uppercase font-mono font-bold"><Trans>Split by model</Trans></div>
          <div className="text-caption text-muted font-mono"><Trans>{modelSplit.models.length} active</Trans></div>
        </div>
        {modelSplit.models.length > 0 ? (
          <>
            <div className="flex h-2.5 rounded-sm overflow-hidden gap-0.5">
              {modelSplit.models.map(m => (
                <div
                  key={m.name}
                  title={t`${m.name}: ${fmtTokens(m.tokens)} tokens (${Math.round((m.tokens / modelSplit.total) * 100)}%)`}
                  style={{ flexGrow: m.tokens / modelSplit.total, background: modelColor(m.name) }}
                />
              ))}
            </div>
            <div className="flex gap-4 text-body-sm font-mono flex-wrap">
              {modelSplit.models.map(m => (
                <span key={m.name} className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-sm" style={{ background: modelColor(m.name) }} />
                  <span className="text-secondary">{m.name}</span>
                  <span className="text-muted">· {fmtTokens(m.tokens)}</span>
                </span>
              ))}
            </div>
          </>
        ) : (
          <div className="text-body-sm text-muted font-mono py-1"><Trans>No model activity in range.</Trans></div>
        )}
      </div>
    </div>
  );
}
