import { EvaluatorKind } from '../api/models';

const MODEL_COLORS: Record<string, string> = {
  'gpt-4o': '#c9944a',
  'gpt-4o-mini': '#6b9eaa',
  'gpt-4.1': '#c9944a',
  'gpt-3.5-turbo': '#d4915c',
  'claude-3.5-sonnet': '#3daa6f',
  'claude-sonnet-4-5': '#3daa6f',
  'claude-3-opus': '#5ba394',
  'claude-3-haiku': '#3daa6f',
};

// Entity palettes use only on-system tokens (accent, teal, success, warn, accent-hover).
// Do not add new brand hexes — extend by repetition with hash mixing.
const MODEL_PALETTE = ['#c9944a', '#6b9eaa', '#3daa6f', '#d4915c', '#deb073', '#6b9eaa', '#3daa6f', '#c9944a'];
const AGENT_PALETTE = ['#c9944a', '#6b9eaa', '#3daa6f', '#d4915c', '#deb073', '#3daa6f', '#6b9eaa', '#c9944a'];

const PROVIDER_COLORS: Record<string, string> = {
  Anthropic: '#3daa6f',
  OpenAI: '#c9944a',
  Google: '#6b9eaa',
  Azure: '#6b9eaa',
  Mistral: '#d4915c',
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

export const EVALUATOR_KIND_COLOR: Record<EvaluatorKind, string> = {
  [EvaluatorKind.Agentic]: '#c9944a',
  [EvaluatorKind.ExactMatch]: '#6b9eaa',
  [EvaluatorKind.NumericMatch]: '#6b9eaa',
  [EvaluatorKind.JsonSchemaMatch]: '#6b9eaa',
};

export const EVALUATOR_KIND_CATEGORY: Record<EvaluatorKind, 'llm' | 'rule'> = {
  [EvaluatorKind.Agentic]: 'llm',
  [EvaluatorKind.ExactMatch]: 'rule',
  [EvaluatorKind.NumericMatch]: 'rule',
  [EvaluatorKind.JsonSchemaMatch]: 'rule',
};

export function statusColor(httpStatus: number): string {
  if (httpStatus >= 200 && httpStatus < 300) return '#3daa6f';
  if (httpStatus >= 400 && httpStatus < 500) return '#d4915c';
  return '#d95555';
}
