import { useState } from 'react';
import { ALL_TIME, type TimeRange, type TimeRangePreset } from '../../../lib/timeRange';
import { useLocalStorageState } from '../../../hooks/useLocalStorageState';
import { DEFAULT_TRACE_SORT, isValidTraceSort, type TraceSort } from '../tracesMeta';

/**
 * Owns the persisted toolbar state of the Traces page so it survives refresh / navigation:
 * `timeRange`, `search`, `showSystem`, and the column `sort` — all project-agnostic, stored under
 * fixed keys. The composable filter bar's project-scoped state (agent, anomaly, tool, …) lives in
 * [[useTraceAdvancedFilters]].
 *
 * `rangeWasRestored` tells the caller whether a stored window already existed, so the first-load
 * auto-default ([[useAutoDefaultRange]]) can be skipped when the user already has a saved window.
 */

const RANGE_KEY = 'traces.timeRange';

const PRESETS = new Set<TimeRangePreset>(['15m', '1h', '6h', '24h', '7d', '30d']);

/** Guard a value parsed from storage against the {@link TimeRange} shape (user-editable JSON). */
export function isValidTimeRange(v: unknown): v is TimeRange {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as { kind?: unknown; preset?: unknown; from?: unknown; to?: unknown };
  if (r.kind === 'all') return true;
  if (r.kind === 'preset') return typeof r.preset === 'string' && PRESETS.has(r.preset as TimeRangePreset);
  if (r.kind === 'absolute') {
    return (r.from === null || typeof r.from === 'string') && (r.to === null || typeof r.to === 'string');
  }
  return false;
}

export interface TraceFilters {
  timeRange: TimeRange;
  setTimeRange: (range: TimeRange) => void;
  search: string;
  setSearch: (value: string) => void;
  showSystem: boolean;
  setShowSystem: (value: boolean) => void;
  sort: TraceSort;
  setSort: (sort: TraceSort) => void;
  /** True when a saved time range was restored at mount (suppresses first-load auto-default). */
  rangeWasRestored: boolean;
}

export function useTraceFilters(): TraceFilters {
  const [rawRange, setTimeRange] = useLocalStorageState<TimeRange>(RANGE_KEY, ALL_TIME);
  const timeRange = isValidTimeRange(rawRange) ? rawRange : ALL_TIME;
  const [search, setSearch] = useLocalStorageState<string>('traces.search', '');
  const [showSystem, setShowSystem] = useLocalStorageState<boolean>('traces.showSystem', false);
  const [rawSort, setSort] = useLocalStorageState<TraceSort>('traces.sort', DEFAULT_TRACE_SORT);
  const sort = isValidTraceSort(rawSort) ? rawSort : DEFAULT_TRACE_SORT;

  const [rangeWasRestored] = useState(() => {
    try {
      return localStorage.getItem(RANGE_KEY) !== null;
    } catch {
      return false;
    }
  });

  return {
    timeRange,
    setTimeRange,
    search,
    setSearch,
    showSystem,
    setShowSystem,
    sort,
    setSort,
    rangeWasRestored,
  };
}
