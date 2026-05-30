/**
 * Whole days remaining until `endsAt`, never negative. Returns 0 when the date
 * is missing, unparseable, or already in the past. `now` is injectable for tests.
 */
export function daysLeft(endsAt: string | null | undefined, now: number = Date.now()): number {
  if (!endsAt) return 0;
  const end = Date.parse(endsAt);
  if (Number.isNaN(end)) return 0;
  const diffMs = end - now;
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}
