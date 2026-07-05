// Model token-split derivation for the Dashboard.
// No JSX, no I/O — unit-tested in dashboardMeta.spec.ts (via the dashboardMeta barrel).

import type { ModelBreakdownDto } from '../../api/models';
import { modelColor } from '../../lib/colors';

export interface ModelSplit {
  models: { name: string; tokens: number }[];
  total: number;
}

/** Top-3 models by token count with total for computing proportions. */
export function computeModelSplit(breakdown: ModelBreakdownDto[]): ModelSplit {
  const sorted = [...breakdown]
    .map(m => ({ name: m.modelName, tokens: m.totalInputTokens + m.totalOutputTokens }))
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 3);
  const total = sorted.reduce((s, m) => s + m.tokens, 0) || 1;
  return { models: sorted, total };
}

/** Runtime color for model split bar — data-driven, kept here so it is not inline. */
export { modelColor };
