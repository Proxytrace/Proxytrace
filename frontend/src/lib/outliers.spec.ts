import { describe, expect, it } from 'vitest';
import { OutlierFlag, isOutlier, outlierFlagKeys } from './outliers';

describe('outliers', () => {
  it('isOutlier is false for 0, null, undefined', () => {
    expect(isOutlier(0)).toBe(false);
    expect(isOutlier(null)).toBe(false);
    expect(isOutlier(undefined)).toBe(false);
  });

  it('isOutlier is true for any set bit', () => {
    expect(isOutlier(OutlierFlag.HighTokens)).toBe(true);
    expect(isOutlier(OutlierFlag.HighTokens | OutlierFlag.LowCacheHit)).toBe(true);
  });

  it('outlierFlagKeys returns no keys when nothing tripped', () => {
    expect(outlierFlagKeys(0)).toEqual([]);
    expect(outlierFlagKeys(null)).toEqual([]);
  });

  it('outlierFlagKeys decodes a single bit', () => {
    expect(outlierFlagKeys(OutlierFlag.HighLatency)).toEqual(['HighLatency']);
  });

  it('outlierFlagKeys decodes multiple bits in declaration order', () => {
    const flags = OutlierFlag.ManyToolCalls | OutlierFlag.HighTokens | OutlierFlag.LowCacheHit;
    expect(outlierFlagKeys(flags)).toEqual(['HighTokens', 'LowCacheHit', 'ManyToolCalls']);
  });

  it('ignores bits outside the known set', () => {
    expect(outlierFlagKeys(OutlierFlag.HighTokens | 0x80)).toEqual(['HighTokens']);
  });

  it('decodes the proxy-blocked bit', () => {
    expect(outlierFlagKeys(OutlierFlag.Blocked)).toEqual(['Blocked']);
    expect(isOutlier(OutlierFlag.Blocked)).toBe(true);
  });
});
