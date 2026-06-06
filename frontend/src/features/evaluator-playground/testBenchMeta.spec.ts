import { describe, it, expect } from 'vitest';
import { EvaluationScore } from '../../api/models';
import { scoreColor, runLabel, tooltipPosition } from './testBenchMeta';

describe('scoreColor', () => {
  it('maps each score to its accent color', () => {
    expect(scoreColor(EvaluationScore.Terrible)).toBe('var(--danger)');
    expect(scoreColor(EvaluationScore.Excellent)).toBe('var(--success)');
  });

  it('falls back to the accent color for a null score', () => {
    expect(scoreColor(null)).toBe('var(--accent-primary)');
  });
});

describe('runLabel', () => {
  it('shows the in-flight label while pending', () => {
    expect(runLabel(true, false)).toBe('Running…');
    expect(runLabel(true, true)).toBe('Running…');
  });

  it('shows "Re-run" once a result exists and "Run evaluator" before the first run', () => {
    expect(runLabel(false, true)).toBe('Re-run');
    expect(runLabel(false, false)).toBe('Run evaluator');
  });
});

describe('tooltipPosition', () => {
  it('right-aligns to the anchor and sits 8px above it', () => {
    expect(tooltipPosition({ right: 500, top: 100 }, 1200)).toEqual({ top: 92, left: 148 });
  });

  it('clamps the left edge to an 8px gutter on narrow viewports', () => {
    expect(tooltipPosition({ right: 200, top: 50 }, 300)).toEqual({ top: 42, left: 8 });
  });
});
