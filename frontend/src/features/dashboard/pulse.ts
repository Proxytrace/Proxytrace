// Live-pulse window constants + transforms for the Dashboard.
// No JSX, no I/O — unit-tested in dashboardMeta.spec.ts (via the dashboardMeta barrel).

/** Fixed contract with the backend pulse series: 60 one-minute buckets over the trailing hour. */
export const PULSE_MINUTES = 60;

/** Rows requested for the promoted live feed (server default is 6; the feed is the centerpiece now). */
export const DASHBOARD_RECENT_TRACES = 12;

/** Normalize the server series to exactly PULSE_MINUTES entries — left-pad zeros, keep newest. */
export function normalizePulse(pulse: number[] | undefined): number[] {
  const src = pulse ?? [];
  if (src.length >= PULSE_MINUTES) return src.slice(src.length - PULSE_MINUTES);
  return [...Array<number>(PULSE_MINUTES - src.length).fill(0), ...src];
}

/** A trace arrived: bump the current-minute (newest) bucket. Expects `pulse` to be a normalized `PULSE_MINUTES`-entry array (callers go through {@link normalizePulse} first). */
export function bumpPulse(pulse: number[]): number[] {
  const next = pulse.slice();
  next[next.length - 1] += 1;
  return next;
}

/** Minute rolled over: slide the window left and open an empty current bucket. Expects `pulse` to be a normalized `PULSE_MINUTES`-entry array (callers go through {@link normalizePulse} first). */
export function shiftPulse(pulse: number[]): number[] {
  return [...pulse.slice(1), 0];
}
