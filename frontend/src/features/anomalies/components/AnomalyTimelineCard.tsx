import { useMemo } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { Card } from '../../../components/ui/Card';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { StackedBar } from '../../../components/charts';
import { agentColor } from '../../../lib/colors';
import type { AgentAnomalyStatDto } from '../../../api/models';
import type { StatisticsBucket } from '../../../lib/time-range';
import { buildDenseTimeline, rankAgents, toStackedData, type AnomalyCell } from '../anomaliesMeta';

interface Props {
  rows: AgentAnomalyStatDto[];
  from: string;
  to: string;
  bucket: StatisticsBucket;
  isLoading: boolean;
  isError: boolean;
  agentName: (id: string) => string;
}

const CHART_HEIGHT = 200;
/** Agents named in the legend; the rest collapse into a "+N more" note. */
const LEGEND_LIMIT = 6;

export function AnomalyTimelineCard({ rows, from, to, bucket, isLoading, isError, agentName }: Props) {
  const { t } = useLingui();

  const { data, truncated, hasData, legend, legendOverflow } = useMemo(() => {
    const dense = buildDenseTimeline(rows, from, to, bucket);
    const segmentLabel = (c: AnomalyCell) =>
      t`${agentName(c.agentId)} · ${c.staticCount} static / ${c.customCount} custom`;
    const ranked = rankAgents(rows, Number.MAX_SAFE_INTEGER);
    return {
      data: toStackedData(dense.buckets, bucket, { color: agentColor, segmentLabel }),
      truncated: dense.truncated,
      hasData: dense.buckets.some(b => b.total > 0),
      legend: ranked.slice(0, LEGEND_LIMIT),
      legendOverflow: Math.max(0, ranked.length - LEGEND_LIMIT),
    };
  }, [rows, from, to, bucket, agentName, t]);

  return (
    <Card padding="md" data-testid="anomaly-timeline-card">
      <div className="flex items-baseline justify-between gap-2 mb-3 flex-wrap">
        <h2 className="text-h2 font-semibold text-primary leading-none"><Trans>Anomalies over time</Trans></h2>
        {truncated && (
          <span className="text-caption text-muted">
            <Trans>Showing the most recent buckets — narrow the range for the full window.</Trans>
          </span>
        )}
      </div>

      {isLoading && (
        <div data-testid="anomaly-timeline-loading">
          <Skeleton height={CHART_HEIGHT} className="rounded-md" />
        </div>
      )}

      {!isLoading && isError && (
        <p className="text-body-sm text-danger py-8 text-center" data-testid="anomaly-timeline-error">
          <Trans>Couldn't load the anomaly timeline.</Trans>
        </p>
      )}

      {!isLoading && !isError && !hasData && (
        <div data-testid="anomaly-timeline-empty">
          <EmptyState title={t`No anomalies in this window`} description={t`Nothing was flagged for the selected range.`} />
        </div>
      )}

      {!isLoading && !isError && hasData && (
        <div data-testid="anomaly-timeline-chart">
          <StackedBar data={data} height={CHART_HEIGHT} integerTicks formatAxisTick={v => String(v)} />
          {legend.length > 0 && (
            <div className="flex items-center gap-x-3 gap-y-1 flex-wrap mt-2" data-testid="anomaly-timeline-legend">
              {legend.map(r => (
                <span key={r.agentId} className="flex items-center gap-1.5 text-body-sm text-secondary">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: agentColor(r.agentId) }}
                    aria-hidden
                  />
                  {agentName(r.agentId)}
                </span>
              ))}
              {legendOverflow > 0 && (
                <span className="text-body-sm text-muted"><Trans>+{legendOverflow} more</Trans></span>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
