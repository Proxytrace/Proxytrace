import { useMemo } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { Card } from '../../../components/ui/Card';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { StackedBar } from '../../../components/charts';
import { agentColor } from '../../../lib/colors';
import type { AgentAnomalyStatDto } from '../../../api/models';
import type { StatisticsBucket } from '../../../lib/time-range';
import { buildDenseTimeline, toStackedData, type AnomalyCell } from '../anomaliesMeta';

interface Props {
  rows: AgentAnomalyStatDto[];
  from: string;
  to: string;
  bucket: StatisticsBucket;
  isLoading: boolean;
  isError: boolean;
  agentName: (id: string) => string;
}

const CHART_HEIGHT = 240;

export function AnomalyTimelineCard({ rows, from, to, bucket, isLoading, isError, agentName }: Props) {
  const { t } = useLingui();

  const { data, truncated, hasData } = useMemo(() => {
    const dense = buildDenseTimeline(rows, from, to, bucket);
    const segmentLabel = (c: AnomalyCell) =>
      t`${agentName(c.agentId)} · ${c.staticCount} static / ${c.customCount} custom`;
    return {
      data: toStackedData(dense.buckets, bucket, { color: agentColor, segmentLabel }),
      truncated: dense.truncated,
      hasData: dense.buckets.some(b => b.total > 0),
    };
  }, [rows, from, to, bucket, agentName, t]);

  return (
    <Card padding="md" data-testid="anomaly-timeline-card">
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <h2 className="text-h2 font-semibold text-primary"><Trans>Anomalies over time</Trans></h2>
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
          <StackedBar data={data} height={CHART_HEIGHT} formatAxisTick={v => String(Math.round(v))} />
        </div>
      )}
    </Card>
  );
}
