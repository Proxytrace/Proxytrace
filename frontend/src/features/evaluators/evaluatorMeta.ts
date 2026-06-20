import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";
import { EvaluatorKind, EvaluationScore } from "../../api/models";

export interface EvaluatorMeta {
  label: MessageDescriptor;
  short: MessageDescriptor;
  desc: MessageDescriptor;
}

export const META: Record<EvaluatorKind, EvaluatorMeta> = {
  [EvaluatorKind.Agentic]: {
    label: msg`LLM Judge`,
    short: msg`LLM judge`,
    desc: msg`A grader model scores responses on a fixed 1–5 scale (Terrible → Excellent) with optional reasoning. Pick a preset or write your own rubric.`,
  },
  [EvaluatorKind.ExactMatch]: {
    label: msg`Exact Match`,
    short: msg`Rule`,
    desc: msg`Passes when the agent response exactly matches the expected output.`,
  },
  [EvaluatorKind.JsonSchemaMatch]: {
    label: msg`JSON Schema Match`,
    short: msg`Rule`,
    desc: msg`Validates the agent response against a JSON Schema definition.`,
  },
  [EvaluatorKind.NumericMatch]: {
    label: msg`Numeric Match`,
    short: msg`Numeric`,
    desc: msg`Extract a number from the response and check it within a tolerance.`,
  },
};

export const KIND_ORDER: EvaluatorKind[] = [
  EvaluatorKind.Agentic,
  EvaluatorKind.ExactMatch,
  EvaluatorKind.NumericMatch,
  EvaluatorKind.JsonSchemaMatch,
];

export type EvaluatorFormState = {
  name: string;
  systemMessage: string;
  presetKey: string;
  jsonSchema: string;
  extractionPattern: string;
  tolerance: string;
};

export function initForm(): EvaluatorFormState {
  return {
    name: "",
    systemMessage: "",
    presetKey: "",
    jsonSchema: "",
    extractionPattern: "",
    tolerance: "0.01",
  };
}

// ── Type categories ──────────────────────────────────────────────────────────
// The rail/detail view group evaluators into three visual categories. This is
// finer-grained than lib/colors.ts EVALUATOR_KIND_CATEGORY (which is 2-way);
// keep it local to this feature.

export type TypeCategory = "llm" | "rule" | "numeric";
export type TypeFilter = "all" | TypeCategory;

export const KIND_CATEGORY: Record<EvaluatorKind, TypeCategory> = {
  [EvaluatorKind.Agentic]: "llm",
  [EvaluatorKind.ExactMatch]: "rule",
  [EvaluatorKind.JsonSchemaMatch]: "rule",
  [EvaluatorKind.NumericMatch]: "numeric",
};

export interface TypeMeta {
  label: MessageDescriptor;
  short: MessageDescriptor;
}

export const TYPE_META: Record<TypeCategory, TypeMeta> = {
  llm: { label: msg`LLM-as-judge`, short: msg`LLM judge` },
  rule: { label: msg`Rule-based`, short: msg`Rule` },
  numeric: { label: msg`Numeric extract`, short: msg`Numeric` },
};

/** Ordered categories used for grouping the rail and for the type filter. */
export const TYPE_CATEGORIES: TypeCategory[] = ["llm", "rule", "numeric"];

// ── Score ordering / labels ──────────────────────────────────────────────────

export const SCORE_ORDER: EvaluationScore[] = [
  EvaluationScore.Terrible,
  EvaluationScore.Bad,
  EvaluationScore.Acceptable,
  EvaluationScore.Good,
  EvaluationScore.Excellent,
];

export const SCORE_LABEL: Record<EvaluationScore, MessageDescriptor> = {
  [EvaluationScore.Terrible]: msg`Terrible`,
  [EvaluationScore.Bad]: msg`Bad`,
  [EvaluationScore.Acceptable]: msg`Acceptable`,
  [EvaluationScore.Good]: msg`Good`,
  [EvaluationScore.Excellent]: msg`Excellent`,
};

// ── Pure derivations ─────────────────────────────────────────────────────────

/** Short score readout for a rail row: 2-decimal for LLM judges, percent otherwise. */
export function fmtScoreShort(
  v: number | null | undefined,
  kind: EvaluatorKind,
  fmtPct: (n: number) => string,
): string {
  if (v == null) return "—";
  if (kind === EvaluatorKind.Agentic) return v.toFixed(2);
  return fmtPct(v);
}

/** Cost in EUR, with a "<€0.01" floor and an em-dash for missing values. */
export function fmtEur(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v < 0.01) return "<€0.01";
  return `€${v.toFixed(2)}`;
}

/** Extracts the unique `{{var}}` placeholders from a rubric, in first-seen order. */
export function extractTemplateVars(text: string): string[] {
  return Array.from(new Set(text.match(/\{\{[a-z_]+\}\}/gi) ?? []));
}

/** Converts a pass-rate trend into a 0–1 pass-fraction series for charts. */
export function passFractionSeries(
  points: { passed: number; total: number }[],
): number[] {
  return points.map((p) => (p.total > 0 ? p.passed / p.total : 0));
}

/** Coarse average pass-fraction over the last `tail` buckets, or null when empty. */
export function tailAvgPassFraction(
  points: { passed: number; total: number }[],
  tail = 7,
): number | null {
  const lastN = points.slice(-tail);
  const totalPass = lastN.reduce((a, p) => a + p.passed, 0);
  const totalAll = lastN.reduce((a, p) => a + p.total, 0);
  return totalAll > 0 ? totalPass / totalAll : null;
}

export interface ScoreBucketRow {
  score: EvaluationScore;
  label: MessageDescriptor;
  count: number;
}

/** Fills every score bucket (zeroed when absent) in canonical order. */
export function fullScoreDistribution(
  buckets: { score: EvaluationScore; count: number }[],
): ScoreBucketRow[] {
  const byScore = new Map(buckets.map((b) => [b.score, b.count]));
  return SCORE_ORDER.map((s) => ({
    score: s,
    label: SCORE_LABEL[s],
    count: byScore.get(s) ?? 0,
  }));
}
