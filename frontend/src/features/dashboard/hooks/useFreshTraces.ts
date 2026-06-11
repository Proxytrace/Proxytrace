// Tracks newly-arrived trace IDs so the list can animate them in.
// The effect is genuinely side-effectful (timeout + ref mutation) and external
// to React's data flow, so a hook is correct per BEST_PRACTICES §4.1.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AgentCallListItemDto } from '../../../api/models';

/** Returns the set of trace IDs that arrived since the last render cycle. */
export function useFreshTraces(traces: AgentCallListItemDto[]): Set<string> {
  const seenRef = useRef<Set<string>>(new Set());
  const initedRef = useRef(false);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());

  const ids = traces.map(t => t.id);
  // Stable JSON string lets us use this in the dep array without object identity issues.
  const idsKey = ids.join(',');

  const handleFresh = useCallback(() => {
    if (traces.length === 0) return;
    if (!initedRef.current) {
      initedRef.current = true;
      seenRef.current = new Set(traces.map(t => t.id));
      return;
    }
    const fresh = traces.filter(t => !seenRef.current.has(t.id)).map(t => t.id);
    if (fresh.length === 0) return;
    fresh.forEach(id => seenRef.current.add(id));
    setFreshIds(new Set(fresh));
    const to = setTimeout(() => setFreshIds(new Set()), 600);
    return to;
  }, // eslint-disable-next-line react-hooks/exhaustive-deps
  [idsKey]);

  useEffect(() => {
    const to = handleFresh();
    return () => { if (to !== undefined) clearTimeout(to); };
  }, [handleFresh]);

  return freshIds;
}
