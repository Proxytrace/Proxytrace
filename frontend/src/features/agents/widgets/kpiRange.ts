import type { AgentOverviewDto } from '../../../api/models';
import { rangeLabel, type RangeKey } from '../../../lib/time-range';

export interface KpiProps {
  overview: AgentOverviewDto;
  range: RangeKey;
  className?: string;
}

export function rangeShort(range: RangeKey): string {
  return rangeLabel(range).split(' · ')[0].toLowerCase();
}
