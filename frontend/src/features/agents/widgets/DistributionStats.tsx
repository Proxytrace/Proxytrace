import type { ReactNode } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import type { MetricDistributionDto } from '../../../api/models';
import { fmtCostEur, fmtLatency, fmtPct, fmtTokens } from '../../../lib/format';
import { Skeleton } from '../../../components/ui/Skeleton';
import { DensityCurve } from '../../../components/charts';
import type { RangeKey } from '../../../lib/time-range';
import { useAgentDistributions } from '../hooks/useAgentDistributions';
import { hasDistributionSignal } from './distributionSignal';
import { STAT_CELL_CLS } from './statCells';

interface Props {
  agentId: string;
  range: RangeKey;
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
  /** Unit word for the hover range when `fmt` has none of its own (tokens / tool calls). */
  valueUnit?: string;
}

function fmtCount(v: number): string {
  return v.toFixed(1);
}

/** Token means/stds are fractional; round before {@link fmtTokens} (which only abbreviates ≥1000). */
function fmtTokenStat(v: number): string {
  return fmtTokens(Math.round(v));
}

/**
 * Per-call / per-conversation distribution cards for the Performance card: the mean ± standard
 * deviation of each metric over the window (successful calls only), each with a density curve of the
 * sample shape. Returned as bare cards so they share the Performance card's single stat grid with the
 * totals. Metrics with no signal (an agent that never caches / calls tools) are dropped.
 */
export function DistributionStats({ agentId, range }: Props) {
  const { t } = useLingui();
  const { distributions, isLoading } = useAgentDistributions(agentId, range);

  if (isLoading || !distributions) {
    return <>{Array.from({ length: 4 }).map((_, i) => <Skeleton key={`dist-skel-${i}`} height={86} className="rounded-lg" />)}</>;
  }

  const allRows: Row[] = [
    { key: 'input', label: <Trans>Input tokens</Trans>, unit: 'call', dist: distributions.inputTokensPerCall, fmt: fmtTokenStat, color: 'var(--teal)', valueUnit: t`tokens` },
    { key: 'output', label: <Trans>Output tokens</Trans>, unit: 'call', dist: distributions.outputTokensPerCall, fmt: fmtTokenStat, color: 'var(--teal)', valueUnit: t`tokens` },
    { key: 'latency', label: <Trans>Latency</Trans>, unit: 'call', dist: distributions.latencyMsPerCall, fmt: fmtLatency, color: 'var(--success)' },
    { key: 'cost', label: <Trans>Cost</Trans>, unit: 'conv', dist: distributions.costPerConversationEur, fmt: fmtCostEur, color: 'var(--warn)' },
    { key: 'cache', label: <Trans>Cache hit (t≥2)</Trans>, unit: 'conv', dist: distributions.cacheHitRatePerConversation, fmt: fmtPct, color: 'var(--accent-primary)' },
    { key: 'tools', label: <Trans>Tool calls</Trans>, unit: 'conv', dist: distributions.toolCallsPerConversation, fmt: fmtCount, color: 'var(--accent-primary)', valueUnit: t`tool calls` },
  ];

  // Drop metrics with no signal (cache "0%", tool calls "0.0" for an agent that never caches / calls
  // tools). See {@link hasDistributionSignal}.
  const rows = allRows.filter(r => hasDistributionSignal(r.dist, r.fmt));

  // Words a histogram bin's count for the hover tooltip so it reads "12 calls", not a bare "12".
  const countLabel = (unit: Unit) => (n: number) =>
    unit === 'call'
      ? n === 1 ? t`1 call` : t`${n} calls`
      : n === 1 ? t`1 conversation` : t`${n} conversations`;

  return (
    <>
      {rows.map(r => (
        <div
          key={r.key}
          data-testid={`distribution-${r.key}`}
          className={STAT_CELL_CLS}
          title={r.dist.sampleCount === 1 ? t`1 sample` : t`${r.dist.sampleCount} samples`}
        >
          <span className="text-caption text-muted font-semibold uppercase tracking-[0.07em] truncate">
            {r.label}
            <span className="text-muted/70"> {r.unit === 'call' ? <Trans>/ call</Trans> : <Trans>/ conv</Trans>}</span>
          </span>
          <div className="flex items-baseline justify-between gap-2 font-mono">
            <span className="text-h1 font-semibold tracking-[-0.02em] leading-none text-primary">{r.fmt(r.dist.mean)}</span>
            <span className="shrink-0 text-body-sm text-muted">± {r.fmt(r.dist.stdDev)}</span>
          </div>
          <DensityCurve bins={r.dist.histogram} color={r.color} formatValue={r.fmt} formatCount={countLabel(r.unit)} valueUnit={r.valueUnit} />
        </div>
      ))}
    </>
  );
}
