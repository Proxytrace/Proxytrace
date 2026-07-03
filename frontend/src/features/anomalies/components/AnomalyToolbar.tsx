import { useLingui } from '@lingui/react/macro';
import { FilterDropdown } from '../../../components/ui/FilterDropdown';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { TimeRangePicker } from '../../../components/ui/TimeRangePicker';
import { agentColor } from '../../../lib/colors';
import type { TimeRange } from '../../../lib/timeRange';
import type { StatisticsBucket } from '../../../lib/time-range';
import type { AgentListItemDto } from '../../../api/models';

interface Props {
  timeRange: TimeRange;
  bucket: StatisticsBucket;
  agentFilter: string;
  agents: AgentListItemDto[];
  onTimeRangeChange: (r: TimeRange) => void;
  onBucketChange: (b: StatisticsBucket) => void;
  onAgentFilterChange: (v: string) => void;
}

export function AnomalyToolbar({
  timeRange, bucket, agentFilter, agents,
  onTimeRangeChange, onBucketChange, onAgentFilterChange,
}: Props) {
  const { t } = useLingui();

  return (
    <div
      className="fade-up relative z-20 flex items-center gap-2 flex-wrap shrink-0 [animation-delay:80ms]"
      data-testid="anomaly-toolbar"
    >
      <FilterDropdown
        label={t`Agent:`}
        testId="anomaly-agent-filter"
        // eslint-disable-next-line lingui/no-unlocalized-strings -- filter sentinel value, not UI copy
        value={agentFilter || '__all'}
        active={!!agentFilter}
        accent={agentFilter ? agentColor(agentFilter) : undefined}
        options={[
          { key: '__all', label: t`All agents` },
          ...agents.map(a => ({ key: a.id, label: a.name, accent: agentColor(a.id) })),
        ]}
        onChange={key => onAgentFilterChange(key === '__all' ? '' : key)}
        width={220}
      />

      <TimeRangePicker value={timeRange} onChange={onTimeRangeChange} testId="anomaly-time" />

      <SegmentedControl<StatisticsBucket>
        value={bucket}
        onChange={onBucketChange}
        segments={[
          { value: 'fiveMinutes', label: t`5 min`, testId: 'anomaly-bucket-fiveMinutes' },
          { value: 'hourly', label: t`Hourly`, testId: 'anomaly-bucket-hourly' },
          { value: 'daily', label: t`Daily`, testId: 'anomaly-bucket-daily' },
        ]}
      />
    </div>
  );
}
