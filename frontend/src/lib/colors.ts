import { EvaluatorKind } from '../api/models';

const MODEL_COLORS: Record<string, string> = {
  'gpt-4o': '#d9a158',
  'gpt-4o-mini': '#74a8b6',
  'gpt-5.4': '#d9a158',
  'gpt-5.4-mini': '#74a8b6',
  'gpt-4.1': '#d9a158',
  'gpt-3.5-turbo': '#dd9a64',
  'claude-3.5-sonnet': '#46b97c',
  'claude-sonnet-4-5': '#46b97c',
  'claude-3-opus': '#5fb39e',
  'claude-3-haiku': '#46b97c',
};

// Fallback palette for models with no explicit MODEL_COLORS entry. Models are intentionally
// grouped by family (all gpt gold, all mini teal, all claude green), so this stays inside the
// warm/teal/green brand tokens and may repeat — distinctness between families is not the goal here.
const MODEL_PALETTE = ['#d9a158', '#74a8b6', '#46b97c', '#dd9a64', '#ecbf83', '#74a8b6', '#46b97c', '#d9a158'];

// Per-entity categorical palette — hash-assigned by agentColor/projectColor/providerColor to give
// each agent/project/provider a stable, at-a-glance-distinct color in charts, legends, and badge
// dots. Unlike the semantic tokens (which deliberately group: success/warn/danger), these must be
// MUTUALLY DISTINCT, so they walk the hue wheel. They are derived from the brand anchors (accent
// gold #d9a158, teal #74a8b6, success #46b97c) by holding a muted saturation/lightness band and
// rotating hue to fill the gaps the ~5 semantic tokens can't cover — the set still reads as one
// calm family (no neon), every entry clears AA (≥4.5:1) as text on the ink surfaces, and no two
// collide. Data-encoding only; never use these for chrome/CTAs/semantics (DESIGN.md §2.1).
const AGENT_PALETTE = [
  '#d9a158', // gold   — brand accent
  '#848ccd', // blue   — teal rotated to a muted periwinkle
  '#46b97c', // green  — brand success
  '#cb86bc', // orchid — muted magenta
  '#97c365', // lime   — gold→green bridge
  '#74a8b6', // teal   — brand teal
  '#d3737f', // rose   — dusty crimson
  '#ae8dc9', // violet — muted
];

const PROVIDER_COLORS: Record<string, string> = {
  Anthropic: '#46b97c',
  OpenAI: '#d9a158',
  Google: '#74a8b6',
  Azure: '#74a8b6',
  Mistral: '#dd9a64',
};

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function agentColor(id: string): string {
  return AGENT_PALETTE[hashStr(id) % AGENT_PALETTE.length];
}

export function modelColor(name: string): string {
  return MODEL_COLORS[name] ?? MODEL_PALETTE[hashStr(name) % MODEL_PALETTE.length];
}

export function providerColor(name: string): string {
  return PROVIDER_COLORS[name] ?? AGENT_PALETTE[hashStr(name) % AGENT_PALETTE.length];
}

export function projectColor(id: string): string {
  return AGENT_PALETTE[hashStr(id) % AGENT_PALETTE.length];
}

/** Stable per-detector color for custom anomaly detectors (rail selection, accents). */
export function detectorColor(id: string): string {
  return AGENT_PALETTE[hashStr(id) % AGENT_PALETTE.length];
}

export const EVALUATOR_KIND_COLOR: Record<EvaluatorKind, string> = {
  [EvaluatorKind.Agentic]: '#d9a158',
  [EvaluatorKind.ExactMatch]: '#74a8b6',
  [EvaluatorKind.NumericMatch]: '#74a8b6',
  [EvaluatorKind.JsonSchemaMatch]: '#74a8b6',
};

/**
 * Color for an evaluator from its kind string (the API serializes the kind as its name).
 * Falls back to teal for any kind not in the palette so a border is never left uncolored.
 */
export function evaluatorColor(kind: string): string {
  return EVALUATOR_KIND_COLOR[kind as EvaluatorKind] ?? '#74a8b6';
}

export const EVALUATOR_KIND_CATEGORY: Record<EvaluatorKind, 'llm' | 'rule'> = {
  [EvaluatorKind.Agentic]: 'llm',
  [EvaluatorKind.ExactMatch]: 'rule',
  [EvaluatorKind.NumericMatch]: 'rule',
  [EvaluatorKind.JsonSchemaMatch]: 'rule',
};

export function statusColor(httpStatus: number): string {
  if (httpStatus >= 200 && httpStatus < 300) return '#46b97c';
  if (httpStatus >= 400 && httpStatus < 500) return '#dd9a64';
  return '#e25d5d';
}

/**
 * Mixes a runtime color toward transparent — `pct` is the opacity of the color.
 * For static token bases (constant color + constant pct) prefer a Tailwind
 * arbitrary class (`bg-[color-mix(...)]`); use this only for data-driven colors.
 */
export const tint = (color: string, pct: number): string =>
  `color-mix(in srgb, ${color} ${pct}%, transparent)`;
