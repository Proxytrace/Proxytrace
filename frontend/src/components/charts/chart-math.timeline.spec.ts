import { describe, it, expect } from 'vitest';
import { computeTimeline, timeToX, xToTime } from './chart-math';

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
