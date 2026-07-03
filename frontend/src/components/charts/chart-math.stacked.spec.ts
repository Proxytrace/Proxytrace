import { describe, it, expect } from 'vitest';
import { axisLabelStep, computeStackedBar, type StackedDatum } from './chart-math';

function datum(label: string, value: number): StackedDatum {
  return { label, segments: [{ value, color: '#000' }] };
}

describe('computeStackedBar integer ticks', () => {
  it('produces four distinct whole-number tick labels for a small count series', () => {
    const data = [datum('a', 2), datum('b', 1)];
    const { grid } = computeStackedBar(data, 640, 200, v => String(Math.round(v)), true);
    expect(grid.map(g => g.val)).toEqual(['3', '2', '1', '0']);
  });

  it('rounds the headroomed max up to a multiple of 3 so quarter ticks stay whole', () => {
    const data = [datum('a', 10)];
    const { grid } = computeStackedBar(data, 640, 200, v => String(Math.round(v)), true);
    // 10 * 1.1 = 11 → 12; ticks 12/8/4/0.
    expect(grid.map(g => g.val)).toEqual(['12', '8', '4', '0']);
  });

  it('keeps a sane 0..3 axis for an empty series', () => {
    const { grid } = computeStackedBar([], 640, 200, v => String(Math.round(v)), true);
    expect(grid.map(g => g.val)).toEqual(['3', '2', '1', '0']);
  });
});

describe('axisLabelStep', () => {
  it('labels every bar when slots are wide enough', () => {
    expect(axisLabelStep(80, ['11:00', '12:00'])).toBe(1);
  });

  it('skips bars when labels would collide', () => {
    // "11:00" needs ~5*6+10 = 40px; a 20px slot fits one label per two bars.
    expect(axisLabelStep(20, ['11:00', '12:00'])).toBe(2);
  });

  it('is resilient to degenerate inputs', () => {
    expect(axisLabelStep(0, ['11:00'])).toBe(1);
    expect(axisLabelStep(50, [])).toBe(1);
  });
});
