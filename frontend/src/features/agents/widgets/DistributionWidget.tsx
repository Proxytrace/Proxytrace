import type { ReactNode } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import type { MetricDistributionDto } from '../../../api/models';
import { fmtCostEur, fmtLatency, fmtPct, fmtTokens } from '../../../lib/format';
import { Skeleton } from '../../../components/ui/Skeleton';
import { MiniHistogram } from '../../../components/charts';
import type { RangeKey } from '../../../lib/time-range';
import { useAgentDistributions } from '../hooks/useAgentDistributions';
import { Widget } from './Widget';

interface Props {
  agentId: string;
  range: RangeKey;
  className?: string;
}

/** Sample unit shown beside each metric label. */
type Unit = 'call' | 'conv';

interface Row {
  key: string;
  label: ReactNode;
  unit: Unit;
  dist: MetricDistributionDto;
  fmt: (v: number) => string;
  color: string;
}

function fmtCount(v: number): string {
  return v.toFixed(1);
}

/** Token means/stds are fractional; round before {@link fmtTokens} (which only abbreviates ≥1000). */
function fmtTokenStat(v: number): string {
  return fmtTokens(Math.round(v));
}

export function DistributionWidget({ agentId, range, className }: Props) {
  const { t } = useLingui();
  const { distributions, isLoading } = useAgentDistributions(agentId, range);

  if (isLoading || !distributions) {
    return (
      <Widget title={t`Distribution`} className={className}>
        <Skeleton height={210} className="rounded-md" />
      </Widget>
    );
  }

  const rows: Row[] = [
    { key: 'input', label: <Trans>Input tokens</Trans>, unit: 'call', dist: distributions.inputTokensPerCall, fmt: fmtTokenStat, color: 'var(--teal)' },
    { key: 'output', label: <Trans>Output tokens</Trans>, unit: 'call', dist: distributions.outputTokensPerCall, fmt: fmtTokenStat, color: 'var(--teal)' },
    { key: 'latency', label: <Trans>Latency</Trans>, unit: 'call', dist: distributions.latencyMsPerCall, fmt: fmtLatency, color: 'var(--success)' },
    { key: 'cost', label: <Trans>Cost</Trans>, unit: 'conv', dist: distributions.costPerConversationEur, fmt: fmtCostEur, color: 'var(--warn)' },
    { key: 'cache', label: <Trans>Cache hit (t≥2)</Trans>, unit: 'conv', dist: distributions.cacheHitRatePerConversation, fmt: fmtPct, color: 'var(--accent-primary)' },
    { key: 'tools', label: <Trans>Tool calls</Trans>, unit: 'conv', dist: distributions.toolCallsPerConversation, fmt: fmtCount, color: 'var(--accent-primary)' },
  ];

  // Per-call token sampling covers every successful call, so an empty token sample means no calls.
  if (distributions.inputTokensPerCall.sampleCount === 0) {
    return (
      <Widget title={t`Distribution`} className={className}>
        <div className="text-body text-muted italic"><Trans>No calls in this range yet</Trans></div>
      </Widget>
    );
  }

  return (
    <Widget title={t`Distribution`} className={className}>
      <div className="flex flex-col gap-3">
        {rows.map(r => (
          <div
            key={r.key}
            data-testid={`distribution-${r.key}`}
            title={r.dist.sampleCount === 1 ? t`1 sample` : t`${r.dist.sampleCount} samples`}
          >
            <div className="flex items-baseline justify-between gap-2 text-body-sm">
              <span className="text-secondary truncate">
                {r.label}
                <span className="text-muted"> {r.unit === 'call' ? <Trans>/ call</Trans> : <Trans>/ conv</Trans>}</span>
              </span>
              <span className="shrink-0 font-mono">
                {r.dist.sampleCount === 0 ? (
                  <span className="text-muted">—</span>
                ) : (
                  <>
                    <span className="font-semibold text-primary">{r.fmt(r.dist.mean)}</span>
                    <span className="text-muted"> ± {r.fmt(r.dist.stdDev)}</span>
                  </>
                )}
              </span>
            </div>
            {r.dist.sampleCount > 0 && r.dist.histogram.length > 0 && (
              <div className="mt-1.5">
                <MiniHistogram bins={r.dist.histogram} color={r.color} formatValue={r.fmt} />
              </div>
            )}
          </div>
        ))}
      </div>
    </Widget>
  );
}
