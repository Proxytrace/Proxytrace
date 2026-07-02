// Re-render pulse for relative timestamps ("12s ago") in the live feed.
// External-sync effect isolated here per BEST_PRACTICES §4.1.

import { useEffect, useState } from 'react';

export function useNowTick(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
