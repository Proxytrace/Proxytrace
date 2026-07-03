import { Trans, useLingui } from '@lingui/react/macro';
import { useNavigate } from 'react-router-dom';
import { DataTable, type DataColumn } from '../../../components/ui/DataTable';
import { Badge } from '../../../components/ui/Badge';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Pagination } from '../../../components/ui/Pagination';
import { agentColor } from '../../../lib/colors';
import { fmtRelative } from '../../../lib/format';
import { tracePreview } from '../../../lib/trace';
import type { AnomalyListItemDto } from '../../../api/models';
import { RECENT_PAGE_SIZE } from '../hooks/useRecentAnomalies';
import { AnomalyReasonChips } from './AnomalyReasonChips';

interface Props {
  items: AnomalyListItemDto[];
  total: number;
  page: number;
  onPageChange: (page: number) => void;
  isLoading: boolean;
  isError: boolean;
}

/** The dashboard's work list: recently flagged calls as a table (agent · message · why · when).
 * Clicking a row opens the call focused in the Traces list. */
export function RecentAnomaliesList({ items, total, page, onPageChange, isLoading, isError }: Props) {
  const { t } = useLingui();
  const navigate = useNavigate();

  /* eslint-disable lingui/no-unlocalized-strings -- `width` values are CSS grid tracks, not UI copy */
  const columns: DataColumn<AnomalyListItemDto>[] = [
    {
      key: 'agent',
      label: t`Agent`,
      width: 'minmax(140px,0.9fr)',
      render: ({ call }) => (
        <span className="flex min-w-0 pr-3" data-testid={`anomaly-recent-row-${call.id}`}>
          <Badge
            variant="tinted"
            color={agentColor(call.agentId ?? call.id)}
            dot
            className="max-w-full min-w-0"
            label={<span className="truncate">{call.agentName ?? t`Unknown agent`}</span>}
          />
        </span>
      ),
    },
    {
      key: 'message',
      label: t`Message`,
      width: 'minmax(0,2fr)',
      render: ({ call }) => {
        const preview = tracePreview(call);
        return (
          <span className="block truncate pr-3 text-body-sm text-secondary" title={preview ?? undefined}>
            {preview ?? <span className="text-muted italic"><Trans>No user message</Trans></span>}
          </span>
        );
      },
    },
    {
      key: 'anomaly',
      label: t`Anomaly`,
      width: 'minmax(100px,1.1fr)',
      render: item => <AnomalyReasonChips item={item} />,
    },
    {
      key: 'when',
      label: t`When`,
      width: '64px',
      className: 'text-right',
      render: ({ call }) => <span className="text-caption text-muted whitespace-nowrap">{fmtRelative(call.createdAt)}</span>,
    },
  ];
  /* eslint-enable lingui/no-unlocalized-strings */

  return (
    <div className="bg-card rounded-lg shadow-[var(--shadow-card)] overflow-hidden" data-testid="anomaly-recent">
      <h2 className="text-h2 font-semibold text-primary px-4 pt-4 pb-3"><Trans>Recent anomalies</Trans></h2>

      {isLoading && (
        <div className="flex flex-col gap-1.5 px-4 pb-4" data-testid="anomaly-recent-loading">
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} height={34} className="rounded-md" />)}
        </div>
      )}

      {!isLoading && isError && (
        <p className="text-body-sm text-danger py-6 text-center" data-testid="anomaly-recent-error">
          <Trans>Couldn't load recent anomalies.</Trans>
        </p>
      )}

      {!isLoading && !isError && (
        <>
          <div data-testid="anomaly-recent-list">
            <DataTable
              columns={columns}
              rows={items}
              rowKey={item => item.call.id}
              onRowClick={item => navigate(`/traces?focus=${item.call.id}`)}
              emptySlot={
                <div data-testid="anomaly-recent-empty-state">
                  <EmptyState title={t`No anomalies in this window`} description={t`Flagged calls will appear here as they arrive.`} />
                </div>
              }
            />
          </div>

          {items.length > 0 && (
            <div className="flex justify-end px-4 py-3">
              <Pagination page={page} total={total} pageSize={RECENT_PAGE_SIZE} onChange={onPageChange} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
