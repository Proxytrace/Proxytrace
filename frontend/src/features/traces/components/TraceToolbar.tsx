import { SearchIcon } from '../../../components/icons';
import { FilterDropdown } from '../../../components/ui/FilterDropdown';
import { TimeRangePicker } from '../../../components/ui/TimeRangePicker';
import { Input } from '../../../components/ui/Input';
import { agentColor } from '../../../lib/colors';
import { cn } from '../../../lib/cn';
import type { TimeRange } from '../../../lib/timeRange';
import type { AgentListItemDto } from '../../../api/models';
import { Trans, useLingui } from '@lingui/react/macro';

interface Props {
  search: string;
  timeRange: TimeRange;
  agentFilter: string;
  showSystem: boolean;
  agents: AgentListItemDto[];
  onSearchChange: (v: string) => void;
  onTimeRangeChange: (r: TimeRange) => void;
  onAgentFilterChange: (v: string) => void;
  onShowSystemChange: (v: boolean) => void;
}

export function TraceToolbar({
  search, timeRange, agentFilter, showSystem, agents,
  onSearchChange, onTimeRangeChange, onAgentFilterChange, onShowSystemChange,
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

      {/* eslint-disable-next-line no-restricted-syntax -- bespoke labeled switch-pill (track + inline label in one tinted control) */}
      <button
        type="button"
        role="switch"
        aria-checked={showSystem}
        onClick={() => onShowSystemChange(!showSystem)}
        title={showSystem ? t`Hide traces from system agents` : t`Show traces from system agents`}
        className={cn(
          'inline-flex items-center gap-2 h-9 px-3 rounded-[10px] text-[12.5px] font-medium cursor-pointer transition-colors duration-200 border-none',
          showSystem ? 'text-accent bg-accent-subtle' : 'text-secondary bg-card',
        )}
        style={{
          boxShadow: showSystem
            ? '0 0 0 1px var(--accent-primary), var(--shadow-pill)'
            : 'var(--shadow-pill)',
        }}
      >
        <span
          className={cn('w-7 h-4 rounded-full relative transition-colors duration-200', showSystem ? 'bg-accent' : 'bg-[rgba(255,255,255,0.12)]')}
          aria-hidden="true"
        >
          <span
            className="absolute top-[2px] w-3 h-3 rounded-full bg-white transition-[left] duration-200"
            style={{ left: showSystem ? '14px' : '2px' }}
          />
        </span>
        <Trans>System Traces</Trans>
      </button>
    </div>
  );
}
