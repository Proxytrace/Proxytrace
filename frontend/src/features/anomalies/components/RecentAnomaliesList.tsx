import { Trans, useLingui } from '@lingui/react/macro';
import { useNavigate } from 'react-router-dom';
import { RowButton } from '../../../components/ui/RowButton';
import { ColoredBadge } from '../../../components/ui/ColoredBadge';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Pagination } from '../../../components/ui/Pagination';
import { agentColor } from '../../../lib/colors';
import { fmtRelative } from '../../../lib/format';
import { tracePreview } from '../../../lib/trace';
import { OUTLIER_FLAG_LABEL, outlierFlagKeys } from '../../../lib/outliers';
import type { AgentCallListItemDto } from '../../../api/models';
import { RECENT_PAGE_SIZE } from '../hooks/useRecentAnomalies';

interface Props {
  items: AgentCallListItemDto[];
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
            {items.map(item => {
              const preview = tracePreview(item);
              const flags = outlierFlagKeys(item.outlierFlags);
              return (
                <RowButton
                  key={item.id}
                  data-testid={`anomaly-recent-row-${item.id}`}
                  onClick={() => navigate(`/traces?focus=${item.id}`)}
                  title={preview ?? tOpenTrace}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2.5 rounded-md px-2 py-1.5 -mx-2 transition-colors duration-100 hover:bg-[var(--bg-wash-hover)]"
                >
                  <ColoredBadge
                    color={agentColor(item.agentId ?? item.id)}
                    label={item.agentName ?? t`Unknown agent`}
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
                  </span>
                  <span className="shrink-0 text-caption text-muted w-14 text-right">{fmtRelative(item.createdAt)}</span>
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
