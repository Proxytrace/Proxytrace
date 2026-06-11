import { describe, it, expect } from 'vitest';
import { readMessageStats, readTraceConversationId } from './message-stats';

describe('readTraceConversationId', () => {
  it('returns the id for a string', () => {
    expect(readTraceConversationId('abc')).toBe('abc');
  });
  it('returns undefined for non-strings', () => {
    expect(readTraceConversationId(undefined)).toBeUndefined();
    expect(readTraceConversationId(42)).toBeUndefined();
    expect(readTraceConversationId({})).toBeUndefined();
  });
});

describe('readMessageStats', () => {
  it('returns null when metadata is missing', () => {
    expect(readMessageStats(undefined)).toBeNull();
  });

  it('returns null when neither usage nor duration is present', () => {
    expect(readMessageStats({ traceConversationId: 'abc' })).toBeNull();
  });

  it('reads usage and duration', () => {
    expect(
      readMessageStats({
        usage: { inputTokens: 14200, outputTokens: 226, totalTokens: 14426 },
        durationMs: 2300,
      }),
    ).toEqual({ inputTokens: 14200, outputTokens: 226, totalTokens: 14426, durationMs: 2300, stoppedEarly: false });
  });

  it('derives totalTokens when the field is absent', () => {
    expect(readMessageStats({ usage: { inputTokens: 10, outputTokens: 5 } })).toEqual({
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
      durationMs: null,
      stoppedEarly: false,
    });
  });

  it('defaults missing or non-numeric token fields to zero', () => {
    expect(readMessageStats({ usage: { inputTokens: 'x', outputTokens: null }, durationMs: 100 })).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      durationMs: 100,
      stoppedEarly: false,
    });
  });

  it('keeps stats with duration but no usage', () => {
    expect(readMessageStats({ durationMs: 500 })).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      durationMs: 500,
      stoppedEarly: false,
    });
  });

  it('flags a turn cut off by the step budget', () => {
    const stats = readMessageStats({ usage: { inputTokens: 1, outputTokens: 1 }, finishReason: 'tool-calls' });
    expect(stats?.stoppedEarly).toBe(true);
  });

  it('does not flag a normally finished turn', () => {
    const stats = readMessageStats({ usage: { inputTokens: 1, outputTokens: 1 }, finishReason: 'stop' });
    expect(stats?.stoppedEarly).toBe(false);
  });
});
