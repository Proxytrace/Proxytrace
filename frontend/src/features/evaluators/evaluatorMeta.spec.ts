import { describe, it, expect } from "vitest";
import { EvaluatorKind, EvaluationScore } from "../../api/models";
import {
  KIND_CATEGORY,
  TYPE_META,
  SCORE_ORDER,
  fmtScoreShort,
  fmtEur,
  extractTemplateVars,
  passFractionSeries,
  tailAvgPassFraction,
  fullScoreDistribution,
} from "./evaluatorMeta";

const pct = (n: number) => `${Math.round(n * 100)}%`;

describe("KIND_CATEGORY", () => {
  it("maps each kind to a category", () => {
    expect(KIND_CATEGORY[EvaluatorKind.Agentic]).toBe("llm");
    expect(KIND_CATEGORY[EvaluatorKind.ExactMatch]).toBe("rule");
    expect(KIND_CATEGORY[EvaluatorKind.JsonSchemaMatch]).toBe("rule");
    expect(KIND_CATEGORY[EvaluatorKind.NumericMatch]).toBe("numeric");
  });
  it("every category has meta", () => {
    for (const cat of Object.values(KIND_CATEGORY)) {
      expect(TYPE_META[cat]).toBeDefined();
    }
  });
});

describe("fmtScoreShort", () => {
  it("returns em-dash for null/undefined", () => {
    expect(fmtScoreShort(null, EvaluatorKind.Agentic, pct)).toBe("—");
    expect(fmtScoreShort(undefined, EvaluatorKind.ExactMatch, pct)).toBe("—");
  });
  it("uses 2 decimals for LLM judge", () => {
    expect(fmtScoreShort(0.8, EvaluatorKind.Agentic, pct)).toBe("0.80");
  });
  it("uses percent for rule/numeric kinds", () => {
    expect(fmtScoreShort(0.5, EvaluatorKind.ExactMatch, pct)).toBe("50%");
  });
});

describe("fmtEur", () => {
  it("em-dash for null", () => {
    expect(fmtEur(null)).toBe("—");
    expect(fmtEur(undefined)).toBe("—");
  });
  it("floors tiny values", () => {
    expect(fmtEur(0.004)).toBe("<€0.01");
  });
  it("formats with two decimals", () => {
    expect(fmtEur(1.5)).toBe("€1.50");
  });
});

describe("extractTemplateVars", () => {
  it("returns unique vars in first-seen order", () => {
    expect(extractTemplateVars("hi {{name}} and {{age}} and {{name}}")).toEqual([
      "{{name}}",
      "{{age}}",
    ]);
  });
  it("returns empty array when none", () => {
    expect(extractTemplateVars("no vars here")).toEqual([]);
  });
});

describe("passFractionSeries", () => {
  it("computes passed/total, guarding zero", () => {
    expect(
      passFractionSeries([
        { passed: 1, total: 2 },
        { passed: 0, total: 0 },
        { passed: 3, total: 3 },
      ]),
    ).toEqual([0.5, 0, 1]);
  });
});

describe("tailAvgPassFraction", () => {
  it("averages the last N buckets", () => {
    const pts = [
      { passed: 0, total: 10 },
      { passed: 5, total: 10 },
      { passed: 5, total: 10 },
    ];
    expect(tailAvgPassFraction(pts, 2)).toBe(0.5);
  });
  it("returns null when no totals", () => {
    expect(tailAvgPassFraction([{ passed: 0, total: 0 }])).toBeNull();
    expect(tailAvgPassFraction([])).toBeNull();
  });
});

describe("fullScoreDistribution", () => {
  it("fills missing buckets with zero in canonical order", () => {
    const rows = fullScoreDistribution([
      { score: EvaluationScore.Good, count: 4 },
    ]);
    expect(rows.map((r) => r.score)).toEqual(SCORE_ORDER);
    expect(rows.find((r) => r.score === EvaluationScore.Good)?.count).toBe(4);
    expect(rows.find((r) => r.score === EvaluationScore.Terrible)?.count).toBe(0);
  });
});
