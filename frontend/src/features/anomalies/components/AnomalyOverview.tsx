import { useCallback, useMemo, useState } from 'react';
import useCurrentProject from '../../../hooks/useCurrentProject';
import { useAgents } from '../../agents/hooks/useAgents';
import { useAnomalyFilters } from '../hooks/useAnomalyFilters';
import { useAnomalyTimeline } from '../hooks/useAnomalyTimeline';
import { useRecentAnomalies } from '../hooks/useRecentAnomalies';
import { useAnomalyLiveUpdates } from '../hooks/useAnomalyLiveUpdates';
import { AnomalyToolbar } from './AnomalyToolbar';
import { AnomalyTimelineCard } from './AnomalyTimelineCard';
import { NeedsHelpStrip } from './NeedsHelpStrip';
import { RecentAnomaliesList } from './RecentAnomaliesList';
import { ID_SHORT_LEN } from '../../../lib/constants';

/**
 * Overview-tab container: owns the filter state, the timeline/recent queries and the live-update
 * subscription, and lays out the toolbar, timeline plot, "needs help" ranking and recent list. The
 * "needs help" ranking is derived from the same timeline rows (no extra query).
 */
export function AnomalyOverview() {
  const { currentProjectId } = useCurrentProject();
  const filters = useAnomalyFilters(currentProjectId);
  const { allAgents } = useAgents();
  const [page, setPage] = useState(1);

  useAnomalyLiveUpdates();

  const timeline = useAnomalyTimeline(filters.timeRange, filters.bucket, filters.agentFilter);
  const recent = useRecentAnomalies(filters.agentFilter, page);

  const nameById = useMemo(() => {
    const map = new Map(allAgents.map(a => [a.id, a.name]));
    return (id: string) => map.get(id) ?? id.slice(0, ID_SHORT_LEN);
  }, [allAgents]);

  // Filtering to a single agent resets pagination so the first page always shows.
  const selectAgent = useCallback((id: string) => {
    filters.setAgentFilter(id);
    setPage(1);
  }, [filters]);

  return (
    <div className="@container flex flex-col gap-4">
      <AnomalyToolbar
        timeRange={filters.timeRange}
        bucket={filters.bucket}
        agentFilter={filters.agentFilter}
        agents={allAgents}
        onTimeRangeChange={filters.setTimeRange}
        onBucketChange={filters.setBucket}
        onAgentFilterChange={selectAgent}
      />

      <AnomalyTimelineCard
        rows={timeline.rows}
        from={timeline.from}
        to={timeline.to}
        bucket={filters.bucket}
        isLoading={timeline.isLoading}
        isError={timeline.isError}
        agentName={nameById}
      />

      <div className="grid grid-cols-1 @3xl:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
        <RecentAnomaliesList
          items={recent.items}
          total={recent.total}
          page={page}
          onPageChange={setPage}
          isLoading={recent.isLoading}
          isError={recent.isError}
        />
        <NeedsHelpStrip rows={timeline.rows} agentName={nameById} onSelectAgent={selectAgent} />
      </div>
    </div>
  );
}
