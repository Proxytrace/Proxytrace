/**
 * Token usage + duration for a finished Tracey turn, read from the assistant message's
 * `metadata.custom` (attached by `TraceyTransport` from the SDK's per-turn aggregate usage). Pure
 * + typed so it can be unit-tested and so the component never asserts on the untyped metadata bag.
 */
export interface MessageStats {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  durationMs: number | null;
  /**
   * True when the turn ended because the tool-loop step budget ran out (`finishReason:
   * 'tool-calls'`) — the model was still mid-tool-use and never answered.
   */
  stoppedEarly: boolean;
}

/** Narrows the assistant message metadata value (typed `unknown`) to the turn's correlation id. */
export function readTraceConversationId(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined;
}

function readNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * Returns the turn's stats, or null when the message carries no usage and no duration (i.e. it has
 * not finished yet, or was restored from a runtime version that didn't record them).
 */
export function readMessageStats(custom: Record<string, unknown> | undefined): MessageStats | null {
  if (!custom) return null;

  const durationRaw = custom.durationMs;
  const durationMs = typeof durationRaw === 'number' && Number.isFinite(durationRaw) ? durationRaw : null;

  const stoppedEarly = custom.finishReason === 'tool-calls';

  const usage = asRecord(custom.usage);
  if (!usage) {
    return durationMs == null
      ? null
      : { inputTokens: 0, outputTokens: 0, totalTokens: 0, durationMs, stoppedEarly };
  }

  const inputTokens = readNumber(usage, 'inputTokens');
  const outputTokens = readNumber(usage, 'outputTokens');
  const totalTokens = readNumber(usage, 'totalTokens') || inputTokens + outputTokens;
  return { inputTokens, outputTokens, totalTokens, durationMs, stoppedEarly };
}
