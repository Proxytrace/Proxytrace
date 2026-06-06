import { EvaluationScore } from '../../api/models';

/** Per-score accent color (CSS var) for the test-bench result pill. */
export const SCORE_COLOR: Record<EvaluationScore, string> = {
  [EvaluationScore.Terrible]: 'var(--danger)',
  [EvaluationScore.Bad]: 'var(--warn)',
  [EvaluationScore.Acceptable]: 'var(--accent-primary)',
  [EvaluationScore.Good]: 'var(--teal)',
  [EvaluationScore.Excellent]: 'var(--success)',
};

/** Resolves the pill color for a score, falling back to the accent for null/unknown scores. */
export function scoreColor(score: EvaluationScore | null | undefined): string {
  return score ? (SCORE_COLOR[score] ?? 'var(--accent-primary)') : 'var(--accent-primary)';
}

/** Label for the run button given the in-flight and prior-result state. */
export function runLabel(pending: boolean, hasResult: boolean): string {
  if (pending) return 'Running…';
  return hasResult ? 'Re-run' : 'Run evaluator';
}

/**
 * Computes the fixed-position coordinates for the reasoning tooltip: it is right-aligned
 * to the anchor, clamped to a max width and an 8px left/edge gutter, and sits just above.
 */
export function tooltipPosition(
  anchor: { right: number; top: number },
  innerWidth: number,
): { top: number; left: number } {
  const width = Math.min(352, innerWidth * 0.8);
  const left = Math.max(8, anchor.right - width);
  const top = anchor.top - 8;
  return { top, left };
}
