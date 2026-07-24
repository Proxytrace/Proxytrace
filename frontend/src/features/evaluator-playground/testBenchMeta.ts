import { msg } from '@lingui/core/macro';
import type { MessageDescriptor } from '@lingui/core';
import { EvaluationScore, EvaluatorKind } from '../../api/models';

/** Short label for an evaluator kind, used in rail rows + pickers. */
export const KIND_LABEL: Record<EvaluatorKind, MessageDescriptor> = {
  [EvaluatorKind.Agentic]: msg`LLM judge`,
  [EvaluatorKind.ExactMatch]: msg`Exact match`,
  [EvaluatorKind.NumericMatch]: msg`Numeric`,
  [EvaluatorKind.JsonSchemaMatch]: msg`JSON schema`,
};

/** Per-score accent color (CSS var) for the test-bench result tag. */
export const SCORE_COLOR: Record<EvaluationScore, string> = {
  [EvaluationScore.Terrible]: 'var(--danger)',
  [EvaluationScore.Bad]: 'var(--warn)',
  [EvaluationScore.Acceptable]: 'var(--accent-primary)',
  [EvaluationScore.Good]: 'var(--teal)',
  [EvaluationScore.Excellent]: 'var(--success)',
};

/** Resolves the tag color for a score, falling back to the accent for null/unknown scores. */
export function scoreColor(score: EvaluationScore | null | undefined): string {
  return score ? (SCORE_COLOR[score] ?? 'var(--accent-primary)') : 'var(--accent-primary)';
}

/** 1–5 numeric rank for a score (Terrible=1 … Excellent=5). */
export const SCORE_NUMBER: Record<EvaluationScore, number> = {
  [EvaluationScore.Terrible]: 1,
  [EvaluationScore.Bad]: 2,
  [EvaluationScore.Acceptable]: 3,
  [EvaluationScore.Good]: 4,
  [EvaluationScore.Excellent]: 5,
};

/** The numeric rank of a score, or null when unscored. */
export function scoreNumber(score: EvaluationScore | null | undefined): number | null {
  return score ? SCORE_NUMBER[score] : null;
}

/** Human anchor label for a score, em-dash when unscored. */
export function scoreAnchor(score: EvaluationScore | null | undefined): string {
  return score ?? '—';
}

/**
 * Signed 1–5 rank delta between two scores (`to - from`), or null when either is
 * unscored. Drives the "vs previous run" chip in the verdict column.
 */
export function scoreDelta(
  from: EvaluationScore | null | undefined,
  to: EvaluationScore | null | undefined,
): number | null {
  const a = scoreNumber(from);
  const b = scoreNumber(to);
  if (a == null || b == null) return null;
  return b - a;
}

/** Label for the run button given the in-flight and prior-result state. */
export function runLabel(pending: boolean, hasResult: boolean): MessageDescriptor {
  if (pending) return msg`Running…`;
  return hasResult ? msg`Re-run` : msg`Run evaluator`;
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
