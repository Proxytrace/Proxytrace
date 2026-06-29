import { useEffect, useState } from 'react';

/**
 * Wall-clock milliseconds elapsed since `startedAt`, refreshed once a second while `active`. The run
 * cards use it to show a ticking duration during a run — the run-level `durationMs` stays null until
 * the run finishes. Returns null when inactive or without a valid start time, so callers fall back to
 * the finalized duration. The 1s interval is a genuine external timer (BEST_PRACTICES §4.1), so it
 * lives in this hook rather than inline in a component.
 */
export function useLiveElapsedMs(startedAt: string | null | undefined, active: boolean): number | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);

  if (!active || !startedAt) return null;
  const start = new Date(startedAt).getTime();
  if (Number.isNaN(start)) return null;
  return Math.max(0, now - start);
}
