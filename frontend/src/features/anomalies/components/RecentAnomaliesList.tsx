import { Trans, useLingui } from '@lingui/react/macro';
import { useNavigate } from 'react-router-dom';
import { RowButton } from '../../../components/ui/RowButton';
import { ColoredBadge } from '../../../components/ui/ColoredBadge';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Pagination } from '../../../components/ui/Pagination';
import { Tooltip } from '../../../components/ui/Tooltip';
import { agentColor } from '../../../lib/colors';
import { fmtRelative } from '../../../lib/format';
import { tracePreview } from '../../../lib/trace';
import { OUTLIER_FLAG_LABEL, outlierFlagKeys } from '../../../lib/outliers';
import type { AnomalyListItemDto } from '../../../api/models';
import { RECENT_PAGE_SIZE } from '../hooks/useRecentAnomalies';

interface Props {
  items: AnomalyListItemDto[];
  total: number;
  page: number;
  onPageChange: (page: number) => void;
  isLoading: boolean;
  isError: boolean;
}

export function RecentAnomaliesList({ items, total, page, onPageChange, isLoading, isError }: Props) {
  const { t, i18n } = useLingui();
  const navigate = useNavigate();
  const tOpenTrace = t`Open trace`;

  return (
    <div className="bg-card rounded-lg shadow-[var(--shadow-card)] p-4 flex flex-col gap-3" data-testid="anomaly-recent">
      <h2 className="text-h2 font-semibold text-primary"><Trans>Recent anomalies</Trans></h2>

      {isLoading && (
        <div className="flex flex-col gap-1.5" data-testid="anomaly-recent-loading">
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} height={34} className="rounded-md" />)}
        </div>
      )}

      {!isLoading && isError && (
        <p className="text-body-sm text-danger py-6 text-center" data-testid="anomaly-recent-error">
          <Trans>Couldn't load recent anomalies.</Trans>
        </p>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <div data-testid="anomaly-recent-empty-state">
          <EmptyState title={t`No anomalies in this window`} description={t`Flagged calls will appear here as they arrive.`} />
        </div>
      )}

      {!isLoading && !isError && items.length > 0 && (
        <>
          <div className="flex flex-col gap-0.5" data-testid="anomaly-recent-list">
            {items.map(({ call, customAnomalies }) => {
              const preview = tracePreview(call);
              // A custom-flagged call shows its detector-name chips instead of the generic
              // "Custom detector" label; the generic chip only remains as a fallback when the
              // bit is set but no attribution row exists (e.g. detector deleted since).
              const flags = outlierFlagKeys(call.outlierFlags)
                .filter(key => key !== 'CustomAnomaly' || customAnomalies.length === 0);
              return (
                <RowButton
                  key={call.id}
                  data-testid={`anomaly-recent-row-${call.id}`}
                  onClick={() => navigate(`/traces?focus=${call.id}`)}
                  title={preview ?? tOpenTrace}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2.5 rounded-md px-2 py-1.5 -mx-2 transition-colors duration-100 hover:bg-[var(--bg-wash-hover)]"
                >
                  <ColoredBadge
                    color={agentColor(call.agentId ?? call.id)}
                    label={call.agentName ?? t`Unknown agent`}
                    dot
                  />
                  <span className="text-body-sm text-secondary truncate">
                    {preview ?? <span className="text-muted italic"><Trans>No user message</Trans></span>}
                  </span>
                  <span className="flex items-center gap-1 justify-end max-w-[45%]">
                    {flags.map(key => (
                      <span
                        key={key}
                        className="shrink-0 rounded-full bg-warn-subtle text-warn text-caption px-1.5 py-0.5 whitespace-nowrap"
                      >
                        {i18n._(OUTLIER_FLAG_LABEL[key])}
                      </span>
                    ))}
                    {customAnomalies.map(hit => (
                      <Tooltip
                        key={hit.detectorId}
                        content={hit.reasoning
                          ? t`Matched "${hit.matchedTrigger}" — ${hit.reasoning}`
                          : t`Matched "${hit.matchedTrigger}"`}
                      >
                        <span
                          data-testid={`anomaly-detector-chip-${call.id}-${hit.detectorId}`}
                          className="shrink-0 rounded-full bg-danger-subtle text-danger text-caption px-1.5 py-0.5 whitespace-nowrap max-w-36 truncate"
                        >
                          {hit.detectorName}
                        </span>
                      </Tooltip>
                    ))}
                  </span>
                  <span className="shrink-0 text-caption text-muted w-14 text-right">{fmtRelative(call.createdAt)}</span>
                </RowButton>
              );
            })}
          </div>

          <div className="flex justify-end">
            <Pagination page={page} total={total} pageSize={RECENT_PAGE_SIZE} onChange={onPageChange} />
          </div>
        </>
      )}
    </div>
  );
}
