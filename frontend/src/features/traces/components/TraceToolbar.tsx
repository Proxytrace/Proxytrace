import { SearchIcon } from '../../../components/icons';
import { TimeRangePicker } from '../../../components/ui/TimeRangePicker';
import { Input } from '../../../components/ui/Input';
import type { TimeRange } from '../../../lib/timeRange';
import { Trans, useLingui } from '@lingui/react/macro';
import { FilterTogglePill } from './FilterTogglePill';

interface Props {
  search: string;
  timeRange: TimeRange;
  showSystem: boolean;
  onSearchChange: (v: string) => void;
  onTimeRangeChange: (r: TimeRange) => void;
  onShowSystemChange: (v: boolean) => void;
}

/**
 * The always-visible toolbar row: search, time range, and the system-traces view toggle.
 * Everything else (agent, anomaly, tool, model, status, numeric ranges) composes through the
 * TraceFilterBar chips rendered below.
 */
export function TraceToolbar({ search, timeRange, showSystem, onSearchChange, onTimeRangeChange, onShowSystemChange }: Props) {
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

      <TimeRangePicker value={timeRange} onChange={onTimeRangeChange} testId="traces-time" />

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
