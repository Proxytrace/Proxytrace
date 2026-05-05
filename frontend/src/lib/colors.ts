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

const MODEL_PALETTE = ['#c9944a', '#6b9eaa', '#3daa6f', '#d4915c', '#c2836b', '#b8834a', '#5ba394', '#d0956f'];
const AGENT_PALETTE = ['#c9944a', '#6b9eaa', '#3daa6f', '#d4915c', '#c2836b', '#deb073', '#5ba394', '#b8834a'];

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

export const EVALUATOR_KIND_COLOR: Record<EvaluatorKind, string> = {
  [EvaluatorKind.Custom]: '#c9944a',
  [EvaluatorKind.ExactMatch]: '#6b9eaa',
  [EvaluatorKind.NumericMatch]: '#6b9eaa',
  [EvaluatorKind.JsonSchemaMatch]: '#6b9eaa',
  [EvaluatorKind.Helpfulness]: '#3daa6f',
  [EvaluatorKind.Politeness]: '#3daa6f',
  [EvaluatorKind.Safety]: '#d95555',
  [EvaluatorKind.ToolUsage]: '#3daa6f',
};

export const EVALUATOR_KIND_CATEGORY: Record<EvaluatorKind, 'llm' | 'rule'> = {
  [EvaluatorKind.Custom]: 'llm',
  [EvaluatorKind.Helpfulness]: 'llm',
  [EvaluatorKind.Politeness]: 'llm',
  [EvaluatorKind.Safety]: 'llm',
  [EvaluatorKind.ToolUsage]: 'llm',
  [EvaluatorKind.ExactMatch]: 'rule',
  [EvaluatorKind.NumericMatch]: 'rule',
  [EvaluatorKind.JsonSchemaMatch]: 'rule',
};

export function statusColor(httpStatus: number): string {
  if (httpStatus >= 200 && httpStatus < 300) return '#3daa6f';
  if (httpStatus >= 400 && httpStatus < 500) return '#d4915c';
  return '#d95555';
}
