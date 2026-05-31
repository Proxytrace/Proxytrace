import { describe, expect, it } from 'vitest';
import { buildScale, formatNum, ticks } from './chart-geometry';

describe('chart-geometry', () => {
  it('anchors the value scale at zero for non-negative data', () => {
    const scale = buildScale([0, 5, 10]);
    expect(scale.domainMin).toBe(0);
    expect(scale.domainMax).toBe(10);
    // Highest value sits above the baseline (smaller y), zero sits on it.
    expect(scale.y(10)).toBeLessThan(scale.baselineY);
    expect(scale.y(0)).toBeCloseTo(scale.baselineY);
  });

  it('extends the domain to include negative values', () => {
    const scale = buildScale([-4, 0, 8]);
    expect(scale.domainMin).toBe(-4);
    expect(scale.domainMax).toBe(8);
  });

  it('collapses all-zero data to a flat baseline without dividing by zero', () => {
    const scale = buildScale([0, 0]);
    expect(scale.domainMax).toBe(0);
    expect(scale.domainMin).toBe(0);
    // y() must stay finite (range is guarded), landing on the baseline.
    expect(Number.isFinite(scale.y(0))).toBe(true);
    expect(scale.y(0)).toBeCloseTo(scale.baselineY);
  });

  it('produces count+1 inclusive gridline ticks across the domain', () => {
    const scale = buildScale([0, 100]);
    const t = ticks(scale, 4);
    expect(t).toHaveLength(5);
    expect(t[0].value).toBeCloseTo(0);
    expect(t[4].value).toBeCloseTo(100);
  });

  it('formats numbers with compact k/M suffixes', () => {
    expect(formatNum(950)).toBe('950');
    expect(formatNum(1500)).toBe('1.5k');
    expect(formatNum(2_300_000)).toBe('2.3M');
  });
});
