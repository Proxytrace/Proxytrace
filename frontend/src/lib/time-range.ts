export type RangeKey = '1h' | '24h' | '7d' | '30d' | 'all';
export type StatisticsBucket = 'fiveMinutes' | 'hourly' | 'daily';

export const RANGE_KEYS: readonly RangeKey[] = ['1h', '24h', '7d', '30d', 'all'] as const;

export function rangeFrom(key: RangeKey): string {
  const now = new Date();
  if (key === '1h') now.setHours(now.getHours() - 1);
  else if (key === '24h') now.setHours(now.getHours() - 24);
  else if (key === '7d') now.setDate(now.getDate() - 7);
  else now.setDate(now.getDate() - 30);
  return now.toISOString();
}

/** Lower bound for a range, or `undefined` for the all-time bucket (no `from` filter). */
export function rangeFromOpt(key: RangeKey): string | undefined {
  return key === 'all' ? undefined : rangeFrom(key);
}

export function rangeLabel(key: RangeKey): string {
  if (key === '1h') return 'Last hour · 5-minute buckets';
  if (key === '24h') return 'Last 24 hours · hourly buckets';
  if (key === '7d') return 'Last 7 days · daily buckets';
  if (key === 'all') return 'All time';
  return 'Last 30 days · daily buckets';
}

export function bucketFor(key: RangeKey): StatisticsBucket {
  if (key === '1h') return 'fiveMinutes';
  if (key === '24h') return 'hourly';
  return 'daily';
}

/** Short window phrase for KPI sub-labels, e.g. "last 7 days". */
export function rangeWindowLabel(key: RangeKey): string {
  if (key === '1h') return 'last hour';
  if (key === '24h') return 'last 24 hours';
  if (key === '7d') return 'last 7 days';
  if (key === 'all') return 'all time';
  return 'last 30 days';
}

/**
 * Compact x-axis label for a bucket timestamp, granularity-aware (HH:mm for intra-day, dd.MM for
 * daily). Formatted in UTC — buckets are UTC-aligned and the dashboard reports in UTC.
 */
export function bucketAxisLabel(iso: string, bucket: StatisticsBucket): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  if (bucket === 'daily') return `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)}`;
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}
