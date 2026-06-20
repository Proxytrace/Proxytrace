import type { AgentCallListItemDto } from '../../api/models';

export interface TraceSummaryStats {
  count: number;
  inputTokens: number;
  outputTokens: number;
  /** Cached subset of {@link inputTokens} across the page. */
  cachedInputTokens: number;
  /** Sum of `costEur` over traces that have a cost; null when none do. */
  totalCostEur: number | null;
  avgLatencyMs: number;
  /** Population standard deviation of `durationMs` — the "±" divergence. */
  latencyStdDevMs: number;
  /** Traces whose HTTP status is not 2xx. */
  errorCount: number;
  /** errorCount / count, in 0..1. */
  errorRate: number;
}

/** A trace is an error when its HTTP status is outside the 2xx range. */
function isError(trace: AgentCallListItemDto): boolean {
  return trace.httpStatus < 200 || trace.httpStatus >= 300;
}

const EMPTY: TraceSummaryStats = {
  count: 0,
  inputTokens: 0,
  outputTokens: 0,
  cachedInputTokens: 0,
  totalCostEur: null,
  avgLatencyMs: 0,
  latencyStdDevMs: 0,
  errorCount: 0,
  errorRate: 0,
};

/**
 * Aggregate the traces currently shown on the page (the current pagination slice).
 * Pure — recompute whenever the slice changes.
 */
export function summarizeTraces(traces: AgentCallListItemDto[]): TraceSummaryStats {
  const count = traces.length;
  if (count === 0) return EMPTY;

  let inputTokens = 0;
  let outputTokens = 0;
  let cachedInputTokens = 0;
  let costSum = 0;
  let hasCost = false;
  let latencySum = 0;
  let errorCount = 0;

  for (const t of traces) {
    inputTokens += t.inputTokens;
    outputTokens += t.outputTokens;
    cachedInputTokens += t.cachedInputTokens;
    if (t.costEur != null) {
      costSum += t.costEur;
      hasCost = true;
    }
    latencySum += t.durationMs;
    if (isError(t)) errorCount += 1;
  }

  const avgLatencyMs = latencySum / count;
  let varianceSum = 0;
  for (const t of traces) {
    const d = t.durationMs - avgLatencyMs;
    varianceSum += d * d;
  }
  const latencyStdDevMs = Math.sqrt(varianceSum / count);

  return {
    count,
    inputTokens,
    outputTokens,
    cachedInputTokens,
    totalCostEur: hasCost ? costSum : null,
    avgLatencyMs,
    latencyStdDevMs,
    errorCount,
    errorRate: errorCount / count,
  };
}
