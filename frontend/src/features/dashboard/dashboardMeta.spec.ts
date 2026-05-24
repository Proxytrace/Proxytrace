import { describe, it, expect } from 'vitest';
import {
  teleFmt,
  computeLatencyStats,
  computeTokenVolume,
  computeModelSplit,
  computeLatencyHist,
  computeTokenByAgent,
  buildAgentNameMap,
  agentCallCount,
  splitTokenStr,
} from './dashboardMeta';
import type { LatencyStatDto, ModelBreakdownDto, AgentTokenUsageDto, AgentBreakdownDto, AgentDto } from '../../api/models';

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

// ── computeTokenVolume ───────────────────────────────────────────────────────

describe('computeTokenVolume', () => {
  it('returns [] for empty', () => expect(computeTokenVolume([])).toEqual([]));

  it('sums input+output per date and sorts', () => {
    const data = [
      { date: '2024-01-02', inputTokens: 10, outputTokens: 20 },
      { date: '2024-01-01', inputTokens: 5, outputTokens: 15 },
      { date: '2024-01-02', inputTokens: 10, outputTokens: 5 },
    ];
    const result = computeTokenVolume(data);
    expect(result).toEqual([20, 45]); // [date1 total, date2 total] sorted by date
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
      { endpointId: 'e-a', modelName: 'a', totalInputTokens: 10, totalOutputTokens: 10, callCount: 1, avgDurationMs: 0 },
      { endpointId: 'e-b', modelName: 'b', totalInputTokens: 100, totalOutputTokens: 100, callCount: 1, avgDurationMs: 0 },
      { endpointId: 'e-c', modelName: 'c', totalInputTokens: 50, totalOutputTokens: 50, callCount: 1, avgDurationMs: 0 },
      { endpointId: 'e-d', modelName: 'd', totalInputTokens: 5, totalOutputTokens: 5, callCount: 1, avgDurationMs: 0 },
    ];
    const { models, total } = computeModelSplit(data);
    expect(models).toHaveLength(3);
    expect(models[0].name).toBe('b');
    expect(models[1].name).toBe('c');
    expect(models[2].name).toBe('a');
    expect(total).toBe(200 + 100 + 20); // b+c+a
  });
});

// ── computeLatencyHist ───────────────────────────────────────────────────────

describe('computeLatencyHist', () => {
  it('returns [] for empty data', () => expect(computeLatencyHist([])).toEqual([]));

  it('places samples into correct buckets', () => {
    const data: LatencyStatDto[] = [
      { endpointId: 'e1', p50Ms: 0, p95Ms: 0, p99Ms: 0, minMs: 0, maxMs: 0, sampleCount: 3 },   // bucket 0
      { endpointId: 'e2', p50Ms: 0, p95Ms: 500, p99Ms: 0, minMs: 0, maxMs: 0, sampleCount: 2 }, // bucket 1
    ];
    const hist = computeLatencyHist(data);
    expect(hist[0]).toBe(3);
    expect(hist[1]).toBe(2);
    expect(hist.length).toBe(10);
  });
});

// ── computeTokenByAgent ──────────────────────────────────────────────────────

describe('computeTokenByAgent', () => {
  it('returns empty for no data', () => {
    const result = computeTokenByAgent([], new Map());
    expect(result.data).toEqual([]);
    expect(result.agentIds).toEqual([]);
  });

  it('groups by date and agent', () => {
    const raw: AgentTokenUsageDto[] = [
      { agentId: 'a1', date: '2024-01-01', inputTokens: 10, outputTokens: 5 },
      { agentId: 'a2', date: '2024-01-01', inputTokens: 20, outputTokens: 10 },
    ];
    const names = new Map([['a1', 'AgentOne'], ['a2', 'AgentTwo']]);
    const { data, agentIds } = computeTokenByAgent(raw, names);
    expect(agentIds).toContain('a1');
    expect(agentIds).toContain('a2');
    expect(data).toHaveLength(1);
    const seg = data[0].segments;
    expect(seg.find(s => s.label === 'AgentOne')?.value).toBe(15);
    expect(seg.find(s => s.label === 'AgentTwo')?.value).toBe(30);
  });
});

// ── buildAgentNameMap ────────────────────────────────────────────────────────

describe('buildAgentNameMap', () => {
  it('maps id→name', () => {
    const agents = [
      { id: 'a1', name: 'Alpha' },
      { id: 'a2', name: 'Beta' },
    ] as AgentDto[];
    const map = buildAgentNameMap(agents);
    expect(map.get('a1')).toBe('Alpha');
    expect(map.get('a2')).toBe('Beta');
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
