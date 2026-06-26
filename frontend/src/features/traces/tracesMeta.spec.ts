import { describe, it, expect } from 'vitest';
import type { AgentCallListItemDto } from '../../api/models';
import { buildRows, latencyBarPct, toolCount, autoTimeRange, hasActiveTraceFilters, traceListView, GRID_TEMPLATE, COL_WIDTHS } from './tracesMeta';

// ── Minimal fixture factory ───────────────────────────────────────────────────

function trace(over: Partial<AgentCallListItemDto> & Pick<AgentCallListItemDto, 'id'>): AgentCallListItemDto {
  return {
    agentId: null,
    agentName: null,
    model: 'gpt-4o',
    provider: 'openai',
    messagePreview: null,
    toolCount: 0,
    inputTokens: 10,
    outputTokens: 5,
    cachedInputTokens: 0,
    durationMs: 200,
    httpStatus: 200,
    finishReason: 'stop',
    errorMessage: null,
    costEur: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    conversationId: null,
    outlierFlags: 0,
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
  it('returns the precomputed response tool-request count', () => {
    expect(toolCount(trace({ id: 'a', toolCount: 2 }))).toBe(2);
  });

  it('returns 0 when the call produced no tool requests (error / empty completion)', () => {
    expect(toolCount(trace({ id: 'b', toolCount: 0 }))).toBe(0);
  });
});


// ── hasActiveTraceFilters (empty-state regression guard) ──────────────────────

describe('hasActiveTraceFilters', () => {
  const none = { agentFilter: '', search: '', timeRangeActive: false, outlierOnly: false };

  it('is false when no filter is applied (so a genuinely empty project shows setup instructions)', () => {
    expect(hasActiveTraceFilters(none)).toBe(false);
  });

  it('is true when an agent is selected', () => {
    expect(hasActiveTraceFilters({ ...none, agentFilter: 'agent-1' })).toBe(true);
  });

  it('is true when a non-blank search term is entered', () => {
    expect(hasActiveTraceFilters({ ...none, search: '  hello ' })).toBe(true);
  });

  it('treats a whitespace-only search as no filter', () => {
    expect(hasActiveTraceFilters({ ...none, search: '   ' })).toBe(false);
  });

  it('is true when a time range is active', () => {
    expect(hasActiveTraceFilters({ ...none, timeRangeActive: true })).toBe(true);
  });

  // The regressed case: the outliers-only toggle hid every row but was not counted as a filter,
  // so a filtered-empty list wrongly showed the first-time setup instructions.
  it('is true when the outliers-only toggle is on', () => {
    expect(hasActiveTraceFilters({ ...none, outlierOnly: true })).toBe(true);
  });
});

// ── traceListView (empty-state branch regression guard) ───────────────────────

describe('traceListView', () => {
  it('renders rows whenever there are rows, regardless of fetching/filtered', () => {
    expect(traceListView(3, false, false)).toBe('rows');
    expect(traceListView(3, true, true)).toBe('rows');
  });

  it('renders the loading skeleton while fetching an empty list', () => {
    expect(traceListView(0, true, false)).toBe('loading');
    // Rows present mid-fetch still render rows, not the skeleton.
    expect(traceListView(2, true, false)).toBe('rows');
  });

  it('renders the first-time setup only for a genuinely empty, unfiltered project', () => {
    expect(traceListView(0, false, false)).toBe('empty-setup');
  });

  // The reported bug: filters (e.g. outliers-only) excluded every row and the page showed setup
  // instructions. An empty-but-filtered list must be 'empty-filtered', never 'empty-setup'.
  it('renders "no matches" (never setup) when filters exclude every row', () => {
    expect(traceListView(0, false, true)).toBe('empty-filtered');
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

// ── autoTimeRange ──────────────────────────────────────────────────────────────

describe('autoTimeRange', () => {
  const now = new Date('2026-06-08T12:00:00Z').getTime();

  it('returns all-time when there is no trace', () => {
    expect(autoTimeRange(null, now)).toEqual({ kind: 'all' });
  });

  it('picks the smallest preset containing the newest trace', () => {
    expect(autoTimeRange(new Date(now - 5 * 60_000).toISOString(), now)).toEqual({ kind: 'preset', preset: '15m' });
    expect(autoTimeRange(new Date(now - 30 * 60_000).toISOString(), now)).toEqual({ kind: 'preset', preset: '1h' });
    expect(autoTimeRange(new Date(now - 3 * 3_600_000).toISOString(), now)).toEqual({ kind: 'preset', preset: '6h' });
    expect(autoTimeRange(new Date(now - 12 * 3_600_000).toISOString(), now)).toEqual({ kind: 'preset', preset: '24h' });
    expect(autoTimeRange(new Date(now - 3 * 86_400_000).toISOString(), now)).toEqual({ kind: 'preset', preset: '7d' });
    expect(autoTimeRange(new Date(now - 20 * 86_400_000).toISOString(), now)).toEqual({ kind: 'preset', preset: '30d' });
    expect(autoTimeRange(new Date(now - 90 * 86_400_000).toISOString(), now)).toEqual({ kind: 'all' });
  });
});
