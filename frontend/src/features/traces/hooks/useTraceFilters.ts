import { useCallback, useState } from 'react';
import { ALL_TIME, type TimeRange, type TimeRangePreset } from '../../../lib/timeRange';
import { useLocalStorageState } from '../../../hooks/useLocalStorageState';

/**
 * Owns the persisted Traces filter bar so the page survives refresh / navigation.
 *
 * `timeRange`, `search`, `showSystem`, and `outlierOnly` are project-agnostic and stored under fixed keys.
 * `agentFilter` is **project-scoped** — agent ids belong to one project and the Traces page
 * stays mounted across project switches, so its value is keyed per project and re-read when the
 * project changes (the others can stay on the simpler `useLocalStorageState`).
 *
 * `rangeWasRestored` tells the caller whether a stored window already existed, so the first-load
 * auto-default ([[useAutoDefaultRange]]) can be skipped when the user already has a saved window.
 */

const RANGE_KEY = 'traces.timeRange';

export function agentFilterKey(projectId: string): string {
  return `traces.agentFilter.${projectId}`;
}

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

function readAgentFilter(projectId: string | null): string {
  if (projectId === null) return '';
  try {
    return localStorage.getItem(agentFilterKey(projectId)) ?? '';
  } catch {
    return '';
  }
}

export interface TraceFilters {
  timeRange: TimeRange;
  setTimeRange: (range: TimeRange) => void;
  search: string;
  setSearch: (value: string) => void;
  showSystem: boolean;
  setShowSystem: (value: boolean) => void;
  outlierOnly: boolean;
  setOutlierOnly: (value: boolean) => void;
  agentFilter: string;
  setAgentFilter: (id: string) => void;
  /** True when a saved time range was restored at mount (suppresses first-load auto-default). */
  rangeWasRestored: boolean;
}

export function useTraceFilters(projectId: string | null): TraceFilters {
  const [rawRange, setTimeRange] = useLocalStorageState<TimeRange>(RANGE_KEY, ALL_TIME);
  const timeRange = isValidTimeRange(rawRange) ? rawRange : ALL_TIME;
  const [search, setSearch] = useLocalStorageState<string>('traces.search', '');
  const [showSystem, setShowSystem] = useLocalStorageState<boolean>('traces.showSystem', false);
  const [outlierOnly, setOutlierOnly] = useLocalStorageState<boolean>('traces.outlierOnly', false);

  const [rangeWasRestored] = useState(() => {
    try {
      return localStorage.getItem(RANGE_KEY) !== null;
    } catch {
      return false;
    }
  });

  // Project-scoped agent filter: re-read whenever the active project changes (the page is not
  // remounted on switch), and write under the project's own key so each project keeps its own.
  // Re-read happens during render via the prev-value pattern (no effect) — React adjusts state
  // when a tracked input changes without an extra commit/render cycle.
  const [agentFilter, setAgentFilterState] = useState(() => readAgentFilter(projectId));
  const [trackedProjectId, setTrackedProjectId] = useState(projectId);
  if (projectId !== trackedProjectId) {
    setTrackedProjectId(projectId);
    setAgentFilterState(readAgentFilter(projectId));
  }

  const setAgentFilter = useCallback(
    (id: string) => {
      setAgentFilterState(id);
      if (projectId === null) return;
      try {
        if (id) localStorage.setItem(agentFilterKey(projectId), id);
        else localStorage.removeItem(agentFilterKey(projectId));
      } catch {
        // storage unavailable or over quota — keep the in-memory value only
      }
    },
    [projectId],
  );

  return {
    timeRange,
    setTimeRange,
    search,
    setSearch,
    showSystem,
    setShowSystem,
    outlierOnly,
    setOutlierOnly,
    agentFilter,
    setAgentFilter,
    rangeWasRestored,
  };
}
