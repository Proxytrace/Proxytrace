import { SearchIcon } from '../../../components/icons';
import { FilterDropdown } from '../../../components/ui/FilterDropdown';
import { TimeRangePicker } from '../../../components/ui/TimeRangePicker';
import { Input } from '../../../components/ui/Input';
import { agentColor } from '../../../lib/colors';
import type { TimeRange } from '../../../lib/timeRange';
import type { AgentListItemDto } from '../../../api/models';
import { Trans, useLingui } from '@lingui/react/macro';
import { FilterTogglePill } from './FilterTogglePill';

interface Props {
  search: string;
  timeRange: TimeRange;
  agentFilter: string;
  showSystem: boolean;
  outlierOnly: boolean;
  agents: AgentListItemDto[];
  onSearchChange: (v: string) => void;
  onTimeRangeChange: (r: TimeRange) => void;
  onAgentFilterChange: (v: string) => void;
  onShowSystemChange: (v: boolean) => void;
  onOutlierOnlyChange: (v: boolean) => void;
}

export function TraceToolbar({
  search, timeRange, agentFilter, showSystem, outlierOnly, agents,
  onSearchChange, onTimeRangeChange, onAgentFilterChange, onShowSystemChange, onOutlierOnlyChange,
}: Props) {
  const { t } = useLingui();
  return (
    <div className="fade-up relative z-20 flex items-center gap-2 flex-wrap shrink-0 [animation-delay:80ms]">
      <div className="flex-1 min-w-[260px] max-w-[420px]">
        <Input
          leftAddon={<SearchIcon size={13} />}
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder={t`Search by trace ID, content, or model…`}
          className="h-9"
        />
      </div>

      <FilterDropdown
        label={t`Agent:`}
        testId="traces-agent-filter"
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

      <TimeRangePicker value={timeRange} onChange={onTimeRangeChange} testId="traces-time" />

      <FilterTogglePill
        checked={outlierOnly}
        onChange={onOutlierOnlyChange}
        testId="traces-outlier-toggle"
        title={outlierOnly ? t`Show all traces` : t`Show only outlier traces`}
        label={<Trans>Outliers only</Trans>}
      />

      <FilterTogglePill
        checked={showSystem}
        onChange={onShowSystemChange}
        testId="traces-system-toggle"
        title={showSystem ? t`Hide traces from system agents` : t`Show traces from system agents`}
        label={<Trans>System Traces</Trans>}
      />
    </div>
  );
}
