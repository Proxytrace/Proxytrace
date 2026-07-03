import { msg } from '@lingui/core/macro';
import type { MessageDescriptor } from '@lingui/core';

/**
 * Per-call outlier characteristic bits. **Mirror of the backend
 * `Proxytrace.Domain.AgentCall.OutlierFlags` enum** — the values are stable; keep them in sync.
 * A call's `outlierFlags` field is the bitwise-OR of the characteristics that tripped at ingestion.
 */
export const OutlierFlag = {
  HighTokens: 1,
  HighLatency: 2,
  LowCacheHit: 4,
  ManyToolCalls: 8,
  CustomAnomaly: 16,
} as const;

export type OutlierFlagKey = keyof typeof OutlierFlag;

/** Human label per characteristic, resolved with `i18n._()` at render (see BEST_PRACTICES §13a). */
export const OUTLIER_FLAG_LABEL: Record<OutlierFlagKey, MessageDescriptor> = {
  HighTokens: msg`High token count`,
  HighLatency: msg`High latency`,
  LowCacheHit: msg`Low cache hit`,
  ManyToolCalls: msg`Many tool calls`,
  CustomAnomaly: msg`Custom detector`,
};

/** True when any outlier bit is set. */
export function isOutlier(flags: number | null | undefined): boolean {
  return typeof flags === 'number' && flags !== 0;
}

/** The characteristics that tripped, as flag keys, in declaration order. */
export function outlierFlagKeys(flags: number | null | undefined): OutlierFlagKey[] {
  if (typeof flags !== 'number' || flags === 0) return [];
  return (Object.keys(OutlierFlag) as OutlierFlagKey[]).filter(key => (flags & OutlierFlag[key]) !== 0);
}
