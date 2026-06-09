import { describe, it, expect } from 'vitest';
import { computeTimeline, timeToX, xToTime, timelineAxisTicks, formatAxisTime, zoomTowardPivot } from './chart-math';

describe('computeTimeline', () => {
  const buckets = [
    { total: 0, errors: 0 },
    { total: 10, errors: 0 },
    { total: 10, errors: 5 },
    { total: 4, errors: 4 },
  ];

  it('produces one bar per bucket spanning the plot width', () => {
    const t = computeTimeline(buckets, 400, 60);
    expect(t.bars).toHaveLength(4);
    expect(t.bars[0].x).toBeGreaterThanOrEqual(t.plotL);
    const last = t.bars[3];
    expect(last.x + last.w).toBeLessThanOrEqual(t.plotR + 0.5);
  });

  it('scales total height to the tallest bucket and keeps errors within total', () => {
    const t = computeTimeline(buckets, 400, 60);
    expect(t.bars[1].totalH).toBeGreaterThan(0);
    t.bars.forEach(b => {
      expect(b.errorH).toBeLessThanOrEqual(b.totalH + 0.001);
      expect(b.errorY + b.errorH).toBeCloseTo(t.baselineY, 1); // errors stacked at the bottom
    });
  });

  it('gives an empty bucket zero height', () => {
    const t = computeTimeline(buckets, 400, 60);
    expect(t.bars[0].totalH).toBe(0);
  });
});

describe('timeToX / xToTime', () => {
  it('round-trips a time within the window', () => {
    const from = 1000, to = 5000, plotL = 10, plotR = 410;
    const x = timeToX(3000, from, to, plotL, plotR);
    expect(x).toBeCloseTo(210, 1);
    expect(xToTime(x, from, to, plotL, plotR)).toBeCloseTo(3000, 1);
  });

  it('clamps outside the plot range', () => {
    expect(xToTime(-50, 1000, 5000, 10, 410)).toBe(1000);
    expect(xToTime(9999, 1000, 5000, 10, 410)).toBe(5000);
  });
});

describe('timelineAxisTicks', () => {
  it('spreads ticks evenly across the plot with inward-anchored edges', () => {
    const ticks = timelineAxisTicks(0, 4000, 10, 410, 5);
    expect(ticks).toHaveLength(5);
    expect(ticks[0].x).toBeCloseTo(10, 5);
    expect(ticks[2].x).toBeCloseTo(210, 5);
    expect(ticks[4].x).toBeCloseTo(410, 5);
    expect(ticks[0].anchor).toBe('start');
    expect(ticks[2].anchor).toBe('middle');
    expect(ticks[4].anchor).toBe('end');
  });

  it('returns nothing for a degenerate window or count', () => {
    expect(timelineAxisTicks(5, 5, 0, 100, 5)).toEqual([]);
    expect(timelineAxisTicks(0, 10, 50, 50, 5)).toEqual([]);
    expect(timelineAxisTicks(0, 10, 0, 100, 1)).toEqual([]);
  });
});

describe('zoomTowardPivot', () => {
  it('shrinks the window by the factor while keeping the pivot fixed in place', () => {
    const { from, to } = zoomTowardPivot(2000, 0, 4000, 0.8);
    expect(to - from).toBeCloseTo(3200, 5);          // 4000 * 0.8
    // pivot keeps its relative position (centered here → stays centered)
    expect((2000 - from) / (to - from)).toBeCloseTo(0.5, 5);
  });

  it('keeps an off-center pivot at the same fraction', () => {
    const before = (3000 - 0) / (4000 - 0);          // 0.75
    const { from, to } = zoomTowardPivot(3000, 0, 4000, 0.5);
    expect((3000 - from) / (to - from)).toBeCloseTo(before, 5);
  });
});

describe('formatAxisTime', () => {
  const t = Date.UTC(2026, 5, 9, 14, 30);
  it('shows a clock time for intraday spans', () => {
    expect(formatAxisTime(t, 3_600_000)).toMatch(/:/);
  });
  it('drops the clock and shows a date for multi-week spans', () => {
    expect(formatAxisTime(t, 30 * 86_400_000)).not.toMatch(/:/);
  });
});
