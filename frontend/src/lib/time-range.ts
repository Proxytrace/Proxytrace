export type RangeKey = '1h' | '24h' | '7d' | '30d';
export type StatisticsBucket = 'fiveMinutes' | 'hourly' | 'daily';

export const RANGE_KEYS: readonly RangeKey[] = ['1h', '24h', '7d', '30d'] as const;

export function rangeFrom(key: RangeKey): string {
  const now = new Date();
  if (key === '1h') now.setHours(now.getHours() - 1);
  else if (key === '24h') now.setHours(now.getHours() - 24);
  else if (key === '7d') now.setDate(now.getDate() - 7);
  else now.setDate(now.getDate() - 30);
  return now.toISOString();
}

export function rangeLabel(key: RangeKey): string {
  if (key === '1h') return 'Last hour · 5-minute buckets';
  if (key === '24h') return 'Last 24 hours · hourly buckets';
  if (key === '7d') return 'Last 7 days · daily buckets';
  return 'Last 30 days · daily buckets';
}

export function bucketFor(key: RangeKey): StatisticsBucket {
  if (key === '1h') return 'fiveMinutes';
  if (key === '24h') return 'hourly';
  return 'daily';
}
