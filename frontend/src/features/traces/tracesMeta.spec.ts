import { describe, it, expect } from 'vitest';
import type { AgentCallDto } from '../../api/models';
import { buildRows, rangeFrom, latencyBarPct, toolCount, GRID_TEMPLATE, COL_WIDTHS } from './tracesMeta';

// ── Minimal fixture factory ───────────────────────────────────────────────────

function trace(over: Partial<AgentCallDto> & Pick<AgentCallDto, 'id'>): AgentCallDto {
  return {
    agentId: null,
    agentName: null,
    model: 'gpt-4o',
    provider: 'openai',
    request: [],
    response: { role: 'assistant', content: '', toolRequests: [], toolCallId: null },
    tools: [],
    inputTokens: 10,
    outputTokens: 5,
    durationMs: 200,
    httpStatus: 200,
    finishReason: 'stop',
    errorMessage: null,
    costEur: null,
    modelParameters: {
      temperature: null, topP: null, reasoningEffort: null, frequencyPenalty: null,
      presencePenalty: null, maxTokens: null, seed: null, stop: null, n: null,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    conversationId: null,
    ...over,
  };
}

// ── buildRows ─────────────────────────────────────────────────────────────────

describe('buildRows', () => {
  it('returns flat rows when no conversationId', () => {
    const traces = [trace({ id: 'a' }), trace({ id: 'b' })];
    const rows = buildRows(traces);
    expect(rows).toHaveLength(2);
    expect(rows[0].type).toBe('flat');
    expect(rows[1].type).toBe('flat');
  });

  it('returns flat row when conversationId appears only once', () => {
    const traces = [trace({ id: 'a', conversationId: 'conv-1' })];
    const rows = buildRows(traces);
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe('flat');
  });

  it('groups traces with the same conversationId appearing more than once', () => {
    const traces = [
      trace({ id: 'a', conversationId: 'conv-1' }),
      trace({ id: 'b', conversationId: 'conv-1' }),
    ];
    const rows = buildRows(traces);
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe('conversation');
    if (rows[0].type === 'conversation') {
      expect(rows[0].conversationId).toBe('conv-1');
      expect(rows[0].turns).toHaveLength(2);
    }
  });

  it('emits the conversation group only once per conversationId', () => {
    const traces = [
      trace({ id: 'a', conversationId: 'conv-1' }),
      trace({ id: 'b', conversationId: 'conv-1' }),
      trace({ id: 'c', conversationId: 'conv-1' }),
    ];
    const rows = buildRows(traces);
    expect(rows).toHaveLength(1);
  });

  it('preserves order: flat traces before and after a group', () => {
    const traces = [
      trace({ id: 'x' }),
      trace({ id: 'a', conversationId: 'conv-1' }),
      trace({ id: 'b', conversationId: 'conv-1' }),
      trace({ id: 'y' }),
    ];
    const rows = buildRows(traces);
    expect(rows).toHaveLength(3);
    expect(rows[0].type).toBe('flat');
    expect(rows[1].type).toBe('conversation');
    expect(rows[2].type).toBe('flat');
  });

  it('handles multiple distinct conversation groups', () => {
    const traces = [
      trace({ id: 'a', conversationId: 'conv-1' }),
      trace({ id: 'b', conversationId: 'conv-1' }),
      trace({ id: 'c', conversationId: 'conv-2' }),
      trace({ id: 'd', conversationId: 'conv-2' }),
    ];
    const rows = buildRows(traces);
    expect(rows).toHaveLength(2);
    expect(rows[0].type).toBe('conversation');
    expect(rows[1].type).toBe('conversation');
    if (rows[0].type === 'conversation') expect(rows[0].conversationId).toBe('conv-1');
    if (rows[1].type === 'conversation') expect(rows[1].conversationId).toBe('conv-2');
  });

  it('returns empty array for empty input', () => {
    expect(buildRows([])).toHaveLength(0);
  });
});

// ── toolCount ─────────────────────────────────────────────────────────────────

describe('toolCount', () => {
  it('counts the tool requests on the response', () => {
    const tr = { id: 't', name: 'n', arguments: '{}' };
    expect(toolCount(trace({ id: 'a', response: { role: 'assistant', content: '', toolRequests: [tr, tr], toolCallId: null } }))).toBe(2);
  });

  it('returns 0 when the call has no response (error / empty completion)', () => {
    expect(toolCount(trace({ id: 'b', response: null }))).toBe(0);
  });

  it('returns 0 when the response has no tool requests', () => {
    expect(toolCount(trace({ id: 'c' }))).toBe(0);
  });
});

// ── rangeFrom ─────────────────────────────────────────────────────────────────

describe('rangeFrom', () => {
  it('returns undefined for "all"', () => {
    expect(rangeFrom('all')).toBeUndefined();
  });

  it('returns an ISO string for "1h" approximately 1 hour ago', () => {
    const before = Date.now() - 3_600_000;
    const result = rangeFrom('1h');
    expect(result).toBeDefined();
    const parsed = new Date(result as string).getTime();
    expect(parsed).toBeGreaterThanOrEqual(before - 100);
    expect(parsed).toBeLessThanOrEqual(before + 100);
  });

  it('returns an ISO string for "24h" approximately 24 hours ago', () => {
    const before = Date.now() - 86_400_000;
    const result = rangeFrom('24h');
    expect(result).toBeDefined();
    const parsed = new Date(result as string).getTime();
    expect(parsed).toBeGreaterThanOrEqual(before - 100);
    expect(parsed).toBeLessThanOrEqual(before + 100);
  });

  it('returns an ISO string for "7d"', () => {
    const before = Date.now() - 7 * 86_400_000;
    const result = rangeFrom('7d');
    expect(result).toBeDefined();
    const parsed = new Date(result as string).getTime();
    expect(parsed).toBeGreaterThanOrEqual(before - 100);
    expect(parsed).toBeLessThanOrEqual(before + 100);
  });

  it('returns an ISO string for "30d"', () => {
    const before = Date.now() - 30 * 86_400_000;
    const result = rangeFrom('30d');
    expect(result).toBeDefined();
    const parsed = new Date(result as string).getTime();
    expect(parsed).toBeGreaterThanOrEqual(before - 100);
    expect(parsed).toBeLessThanOrEqual(before + 100);
  });

  it('returns undefined for unknown keys', () => {
    expect(rangeFrom('unknown')).toBeUndefined();
  });
});

// ── latencyBarPct ─────────────────────────────────────────────────────────────

describe('latencyBarPct', () => {
  it('scales 0ms to 0%', () => {
    expect(latencyBarPct(0)).toBe(0);
  });

  it('caps at 100% for very high ms', () => {
    expect(latencyBarPct(100_000)).toBe(100);
  });

  it('returns 50 for 3000ms', () => {
    expect(latencyBarPct(3000)).toBe(50);
  });
});

// ── GRID_TEMPLATE / COL_WIDTHS ────────────────────────────────────────────────

describe('GRID_TEMPLATE', () => {
  it('is a string joining all COL_WIDTHS with spaces', () => {
    expect(GRID_TEMPLATE).toBe(COL_WIDTHS.join(' '));
  });
});
