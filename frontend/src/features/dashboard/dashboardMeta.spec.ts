import { describe, it, expect } from 'vitest';
import {
  teleFmt,
  computeLatencyStats,
  computeTokenSeries,
  fillTokenGrid,
  computeModelSplit,
  computeEndpointLatency,
  computeAgentFleet,
  downsampleSum,
  FLEET_SPARK_POINTS,
  agentCallCount,
  splitTokenStr,
  normalizePulse,
  bumpPulse,
  shiftPulse,
} from './dashboardMeta';
import type { LatencyStatDto, ModelBreakdownDto, AgentTokenUsageDto, AgentBreakdownDto, AgentListItemDto } from '../../api/models';

// ── teleFmt ──────────────────────────────────────────────────────────────────

describe('teleFmt', () => {
  it('returns — for undefined', () => expect(teleFmt(undefined)).toBe('—'));
  it('returns — for null', () => expect(teleFmt(null)).toBe('—'));
  it('stringifies numbers without fmt', () => expect(teleFmt(42)).toBe('42'));
  it('applies fmt to numbers', () => expect(teleFmt(3.14, n => n.toFixed(1))).toBe('3.1'));
  it('passes strings through', () => expect(teleFmt('v1.2')).toBe('v1.2'));
});

// ── computeLatencyStats ──────────────────────────────────────────────────────

describe('computeLatencyStats', () => {
  it('returns null for empty data', () => expect(computeLatencyStats([])).toBeNull());

  it('computes weighted averages', () => {
    const data: LatencyStatDto[] = [
      { endpointId: 'e1', p50Ms: 100, p95Ms: 200, p99Ms: 300, minMs: 50, maxMs: 400, sampleCount: 2 },
      { endpointId: 'e2', p50Ms: 200, p95Ms: 400, p99Ms: 600, minMs: 100, maxMs: 800, sampleCount: 2 },
    ];
    const stats = computeLatencyStats(data);
    expect(stats).not.toBeNull();
    // total = 4, p50 = (100*2 + 200*2)/4 = 150
    expect(stats?.p50).toBe(150);
    expect(stats?.samples).toBe(4);
  });
});

// ── fillTokenGrid ────────────────────────────────────────────────────────────

const DAY = 24 * 60 * 60_000;

describe('fillTokenGrid', () => {
  it('emits a continuous grid, gap-filling missing buckets with 0', () => {
    const d0 = Date.parse('2024-01-01T00:00:00Z');
    const d2 = d0 + 2 * DAY;
    // Data on day 0 and day 2 — day 1 is a gap that must render as 0.
    const sums = new Map<number, number>([[d0, 30], [d2, 45]]);
    const result = fillTokenGrid(sums, d0, d2, DAY);
    expect(result.values).toEqual([30, 0, 45]);
    expect(result.buckets).toEqual([
      '2024-01-01T00:00:00.000Z',
      '2024-01-02T00:00:00.000Z',
      '2024-01-03T00:00:00.000Z',
    ]);
  });

  it('produces equal-length values/buckets spanning the whole window', () => {
    const start = Date.parse('2024-03-01T00:00:00Z');
    const end = start + 29 * DAY; // 30-day window
    const { values, buckets } = fillTokenGrid(new Map(), start, end, DAY);
    expect(values).toHaveLength(30);
    expect(buckets).toHaveLength(30);
    expect(values.every(v => v === 0)).toBe(true);
  });
});

// ── computeTokenSeries ───────────────────────────────────────────────────────

describe('computeTokenSeries', () => {
  it('returns empty arrays for empty', () => expect(computeTokenSeries([], 'all', 'daily')).toEqual({ values: [], buckets: [] }));

  // Real bucketStart values are UTC-aligned (backend truncates), so tests use aligned boundaries.
  const todayUtc = Date.now() - (Date.now() % DAY);

  it('sums duplicate buckets and pads to >=2 points so a single-bucket all-time view still renders', () => {
    const iso = new Date(todayUtc).toISOString();
    const data = [
      { bucketStart: iso, inputTokens: 10, outputTokens: 20 },
      { bucketStart: iso, inputTokens: 10, outputTokens: 5 },
    ];
    const result = computeTokenSeries(data, 'all', 'daily');
    expect(result.values).toEqual([0, 45]); // padded leading bucket + today's sum
  });

  it('gap-fills real time spacing rather than collapsing sparse buckets equidistantly', () => {
    const recent = new Date(todayUtc).toISOString();
    const twoDaysAgo = new Date(todayUtc - 2 * DAY).toISOString();
    const result = computeTokenSeries(
      [
        { bucketStart: twoDaysAgo, inputTokens: 100, outputTokens: 0 },
        { bucketStart: recent, inputTokens: 50, outputTokens: 0 },
      ],
      'all',
      'daily',
    );
    // 3 daily buckets (gap day filled with 0), not 2 equidistant points.
    expect(result.values).toEqual([100, 0, 50]);
  });

  it('steps at the supplied granularity (hourly), so short all-time spans keep detail', () => {
    const HOUR = 60 * 60_000;
    const nowHour = Date.now() - (Date.now() % HOUR);
    const data = [
      { bucketStart: new Date(nowHour - 2 * HOUR).toISOString(), inputTokens: 7, outputTokens: 0 },
      { bucketStart: new Date(nowHour).toISOString(), inputTokens: 3, outputTokens: 0 },
    ];
    const result = computeTokenSeries(data, 'all', 'hourly');
    // 3 hourly buckets spanning the 2-hour data window, gap hour filled with 0.
    expect(result.values).toEqual([7, 0, 3]);
  });
});

// ── computeModelSplit ────────────────────────────────────────────────────────

describe('computeModelSplit', () => {
  it('returns empty models with total=1 for empty', () => {
    const result = computeModelSplit([]);
    expect(result.models).toEqual([]);
    expect(result.total).toBe(1);
  });

  it('returns top-3 sorted by tokens', () => {
    const data: ModelBreakdownDto[] = [
      { endpointId: 'e-a', modelName: 'a', totalInputTokens: 10, totalOutputTokens: 10, totalCachedInputTokens: 0, callCount: 1, avgDurationMs: 0 },
      { endpointId: 'e-b', modelName: 'b', totalInputTokens: 100, totalOutputTokens: 100, totalCachedInputTokens: 0, callCount: 1, avgDurationMs: 0 },
      { endpointId: 'e-c', modelName: 'c', totalInputTokens: 50, totalOutputTokens: 50, totalCachedInputTokens: 0, callCount: 1, avgDurationMs: 0 },
      { endpointId: 'e-d', modelName: 'd', totalInputTokens: 5, totalOutputTokens: 5, totalCachedInputTokens: 0, callCount: 1, avgDurationMs: 0 },
    ];
    const { models, total } = computeModelSplit(data);
    expect(models).toHaveLength(3);
    expect(models[0].name).toBe('b');
    expect(models[1].name).toBe('c');
    expect(models[2].name).toBe('a');
    expect(total).toBe(200 + 100 + 20); // b+c+a
  });
});

// ── computeEndpointLatency ───────────────────────────────────────────────────

describe('computeEndpointLatency', () => {
  const agents = [
    { id: 'a1', name: 'AgentOne', endpointId: 'e1', endpointName: 'Azure', isSystemAgent: false },
    { id: 'a2', name: 'AgentTwo', endpointId: 'e1', endpointName: 'Azure', isSystemAgent: false },
  ] as AgentListItemDto[];

  it('returns [] for empty data', () => expect(computeEndpointLatency([], agents)).toEqual([]));

  it('resolves endpoint names from agents and falls back to a short id', () => {
    const data: LatencyStatDto[] = [
      { endpointId: 'e1', p50Ms: 100, p95Ms: 200, p99Ms: 300, minMs: 50, maxMs: 400, sampleCount: 5 },
      { endpointId: 'unknown-endpoint-id', p50Ms: 10, p95Ms: 20, p99Ms: 30, minMs: 5, maxMs: 40, sampleCount: 1 },
    ];
    const rows = computeEndpointLatency(data, agents);
    expect(rows[0].name).toBe('Azure');
    expect(rows[1].name).toBe('unknown-'); // first 8 chars of the id
  });

  it('sorts by sample count desc', () => {
    const data: LatencyStatDto[] = [
      { endpointId: 'e-small', p50Ms: 1, p95Ms: 2, p99Ms: 3, minMs: 1, maxMs: 4, sampleCount: 2 },
      { endpointId: 'e-big', p50Ms: 1, p95Ms: 2, p99Ms: 3, minMs: 1, maxMs: 4, sampleCount: 9 },
    ];
    expect(computeEndpointLatency(data, []).map(r => r.endpointId)).toEqual(['e-big', 'e-small']);
  });
});

// ── downsampleSum ────────────────────────────────────────────────────────────

describe('downsampleSum', () => {
  it('passes through when already small enough', () => {
    expect(downsampleSum([1, 2, 3], 5)).toEqual([1, 2, 3]);
  });

  it('sum-pools while preserving the grand total and order', () => {
    const values = Array.from({ length: 100 }, (_, i) => i);
    const out = downsampleSum(values, 10);
    expect(out).toHaveLength(10);
    expect(out.reduce((a, b) => a + b, 0)).toBe(values.reduce((a, b) => a + b, 0));
    expect(out[0]).toBeLessThan(out[9]); // ascending input keeps its shape
  });
});

// ── computeAgentFleet ────────────────────────────────────────────────────────

describe('computeAgentFleet', () => {
  const DAY_MS = 24 * 60 * 60_000;
  const todayUtc = Date.now() - (Date.now() % DAY_MS);
  const agents = [
    { id: 'a1', name: 'AgentOne', endpointId: 'e1', endpointName: 'Azure', toolCount: 2, lastUsedAt: null, isSystemAgent: false },
    { id: 'a2', name: 'AgentTwo', endpointId: 'e1', endpointName: 'Azure', toolCount: 0, lastUsedAt: null, isSystemAgent: false },
    { id: 'sys', name: 'Optimizer', endpointId: 'e1', endpointName: 'Azure', toolCount: 0, lastUsedAt: null, isSystemAgent: true },
  ] as AgentListItemDto[];
  const breakdown = [
    { agentId: 'a1', callCount: 3 },
    { agentId: 'a2', callCount: 7 },
    { agentId: 'sys', callCount: 99 },
  ] as AgentBreakdownDto[];

  it('excludes system agents but keeps zero-traffic agents', () => {
    const fleet = computeAgentFleet(agents, breakdown, [], 'all', 'daily');
    expect(fleet.map(e => e.id).sort()).toEqual(['a1', 'a2']);
    expect(fleet.every(e => e.tokens === 0 && e.series.length === 0)).toBe(true);
  });

  it('totals tokens per agent, computes fleet share, and sorts by tokens desc', () => {
    const iso = new Date(todayUtc).toISOString();
    const raw: AgentTokenUsageDto[] = [
      { agentId: 'a1', bucketStart: iso, inputTokens: 10, outputTokens: 5, cachedInputTokens: 0 },
      { agentId: 'a2', bucketStart: iso, inputTokens: 20, outputTokens: 10, cachedInputTokens: 0 },
      { agentId: 'sys', bucketStart: iso, inputTokens: 99, outputTokens: 0, cachedInputTokens: 0 },
    ];
    const fleet = computeAgentFleet(agents, breakdown, raw, 'all', 'daily');
    expect(fleet.map(e => e.id)).toEqual(['a2', 'a1']);
    expect(fleet[0].tokens).toBe(30);
    expect(fleet[0].share).toBeCloseTo(2 / 3);
    expect(fleet[0].traces).toBe(7);
    expect(fleet[1].traces).toBe(3);
  });

  it('builds all sparklines on one shared grid, gap-filled and ≥2 points', () => {
    const iso = new Date(todayUtc).toISOString();
    const older = new Date(todayUtc - 2 * DAY_MS).toISOString();
    const raw: AgentTokenUsageDto[] = [
      { agentId: 'a1', bucketStart: older, inputTokens: 100, outputTokens: 0, cachedInputTokens: 0 },
      { agentId: 'a2', bucketStart: iso, inputTokens: 50, outputTokens: 0, cachedInputTokens: 0 },
    ];
    const fleet = computeAgentFleet(agents, breakdown, raw, 'all', 'daily');
    const a1 = fleet.find(e => e.id === 'a1');
    const a2 = fleet.find(e => e.id === 'a2');
    // Shared window spans both agents' buckets: 3 daily points each.
    expect(a1?.series).toEqual([100, 0, 0]);
    expect(a2?.series).toEqual([0, 0, 50]);
  });

  it('caps sparkline resolution at FLEET_SPARK_POINTS', () => {
    const HOUR = 60 * 60_000;
    const nowHour = Date.now() - (Date.now() % HOUR);
    const raw: AgentTokenUsageDto[] = Array.from({ length: 100 }, (_, i) => ({
      agentId: 'a1',
      bucketStart: new Date(nowHour - i * HOUR).toISOString(),
      inputTokens: 1,
      outputTokens: 0,
      cachedInputTokens: 0,
    }));
    const fleet = computeAgentFleet(agents, breakdown, raw, 'all', 'hourly');
    const a1 = fleet.find(e => e.id === 'a1');
    expect(a1?.series.length).toBeLessThanOrEqual(FLEET_SPARK_POINTS);
    expect(a1?.series.reduce((a, b) => a + b, 0)).toBe(100); // total preserved
  });
});

// ── agentCallCount ───────────────────────────────────────────────────────────

describe('agentCallCount', () => {
  it('returns 0 for unknown agent', () => {
    expect(agentCallCount([], 'x')).toBe(0);
  });

  it('returns correct count', () => {
    const breakdown = [{ agentId: 'a1', callCount: 42 }] as AgentBreakdownDto[];
    expect(agentCallCount(breakdown, 'a1')).toBe(42);
  });
});

// ── splitTokenStr ────────────────────────────────────────────────────────────

describe('splitTokenStr', () => {
  it('splits suffix from number', () => {
    // fmtTokens produces strings like "1.2K" or "500"
    const result = splitTokenStr(1500);
    expect(result.num).toMatch(/^\d/);
    expect(typeof result.suffix).toBe('string');
  });

  it('handles zero', () => {
    const result = splitTokenStr(0);
    expect(result.num).toBeTruthy();
  });
});

// ── normalizePulse / bumpPulse / shiftPulse ──

describe('normalizePulse', () => {
  it('pads a short series with leading zeros to 60 entries', () => {
    const out = normalizePulse([1, 2, 3]);
    expect(out).toHaveLength(60);
    expect(out.slice(57)).toEqual([1, 2, 3]);
    expect(out[0]).toBe(0);
  });
  it('keeps the newest 60 entries of a long series', () => {
    const out = normalizePulse(Array.from({ length: 70 }, (_, i) => i));
    expect(out).toHaveLength(60);
    expect(out[59]).toBe(69);
    expect(out[0]).toBe(10);
  });
  it('returns all zeros for undefined', () => {
    expect(normalizePulse(undefined)).toEqual(Array(60).fill(0));
  });
});

describe('bumpPulse', () => {
  it('increments the newest bucket without mutating the input', () => {
    const input = Array(60).fill(0);
    const out = bumpPulse(input);
    expect(out[59]).toBe(1);
    expect(input[59]).toBe(0);
  });
});

describe('shiftPulse', () => {
  it('drops the oldest bucket and opens an empty one', () => {
    const input = [...Array(59).fill(2), 5];
    const out = shiftPulse(input);
    expect(out).toHaveLength(60);
    expect(out[58]).toBe(5);
    expect(out[59]).toBe(0);
  });
});
