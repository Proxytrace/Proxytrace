import { EvaluatorKind } from "../../api/models";

export interface EvaluatorMeta {
  label: string;
  short: string;
  desc: string;
}

export const META: Record<EvaluatorKind, EvaluatorMeta> = {
  [EvaluatorKind.Agentic]: {
    label: "LLM Judge",
    short: "LLM judge",
    desc: "A grader model scores responses on a fixed 1–5 scale (Terrible → Excellent) with optional reasoning. Pick a preset or write your own rubric.",
  },
  [EvaluatorKind.ExactMatch]: {
    label: "Exact Match",
    short: "Rule",
    desc: "Passes when the agent response exactly matches the expected output.",
  },
  [EvaluatorKind.JsonSchemaMatch]: {
    label: "JSON Schema Match",
    short: "Rule",
    desc: "Validates the agent response against a JSON Schema definition.",
  },
  [EvaluatorKind.NumericMatch]: {
    label: "Numeric Match",
    short: "Numeric",
    desc: "Extract a number from the response and check it within a tolerance.",
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
