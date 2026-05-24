import { useEffect } from 'react';
import type { TraceRow } from '../tracesMeta';

/**
 * Scrolls a data-trace-id element into view when pendingScrollId is set.
 * This is a genuine DOM side-effect per BEST_PRACTICES §4.1. Depends on rows
 * and expandedConvs so it retries after a conversation group expands.
 */
export function useScrollToTrace(
  pendingScrollId: string | null,
  onScrolled: () => void,
  rows: TraceRow[],
  expandedConvs: Set<string>,
) {
  useEffect(() => {
    if (!pendingScrollId) return;
    const t = setTimeout(() => {
      const el = document.querySelector(`[data-trace-id="${pendingScrollId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        onScrolled();
      }
    }, 50);
    return () => clearTimeout(t);
  }, [pendingScrollId, onScrolled, rows, expandedConvs]);
}
