import { useEffect, useState } from 'react';

/**
 * Whole seconds since the component mounted, ticking once a second while `active` (a timer is an
 * external system, so this is one of the sanctioned effect shapes — BEST_PRACTICES §4.1). The
 * value freezes when `active` drops, so a finished wait keeps its last readout.
 */
export function useElapsedSeconds(active: boolean): number {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(start);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [active]);
  return Math.max(0, Math.floor((now - start) / 1_000));
}
