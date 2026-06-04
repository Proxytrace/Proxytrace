import { describe, it, expect } from 'vitest';
import {
  teleFmt,
  computeLatencyStats,
  computeTokenVolume,
  computeModelSplit,
  computeLatencyHist,
  computeTokenAgentShare,
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

  it('sums input+output per bucket and sorts chronologically', () => {
    const data = [
      { bucketStart: '2024-01-02T00:00:00+00:00', inputTokens: 10, outputTokens: 20 },
      { bucketStart: '2024-01-01T00:00:00+00:00', inputTokens: 5, outputTokens: 15 },
      { bucketStart: '2024-01-02T00:00:00+00:00', inputTokens: 10, outputTokens: 5 },
    ];
    const result = computeTokenVolume(data);
    expect(result).toEqual([20, 45]); // [bucket1 total, bucket2 total] sorted by bucketStart
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

// ── computeTokenAgentShare ───────────────────────────────────────────────────

describe('computeTokenAgentShare', () => {
  const agents = [
    { id: 'a1', name: 'AgentOne', isSystemAgent: false },
    { id: 'a2', name: 'AgentTwo', isSystemAgent: false },
    { id: 'sys', name: 'Optimizer', isSystemAgent: true },
  ] as AgentDto[];

  it('returns empty for no data', () => {
    const result = computeTokenAgentShare([], agents);
    expect(result.agents).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('totals per agent, sorts desc, and computes share', () => {
    const raw: AgentTokenUsageDto[] = [
      { agentId: 'a1', bucketStart: '2024-01-01T00:00:00+00:00', inputTokens: 10, outputTokens: 5 },
      { agentId: 'a2', bucketStart: '2024-01-01T00:00:00+00:00', inputTokens: 20, outputTokens: 10 },
      { agentId: 'a1', bucketStart: '2024-01-01T01:00:00+00:00', inputTokens: 5, outputTokens: 0 },
    ];
    const { agents: list, total } = computeTokenAgentShare(raw, agents);
    expect(total).toBe(50);
    expect(list.map(a => a.name)).toEqual(['AgentTwo', 'AgentOne']); // 30 before 20
    expect(list[0].tokens).toBe(30);
    expect(list[0].share).toBeCloseTo(0.6);
    expect(list[1].inputTokens).toBe(15);
    expect(list[1].outputTokens).toBe(5);
  });

  it('excludes system agents', () => {
    const raw: AgentTokenUsageDto[] = [
      { agentId: 'a1', bucketStart: '2024-01-01T00:00:00+00:00', inputTokens: 10, outputTokens: 0 },
      { agentId: 'sys', bucketStart: '2024-01-01T00:00:00+00:00', inputTokens: 99, outputTokens: 0 },
    ];
    const { agents: list, total } = computeTokenAgentShare(raw, agents);
    expect(total).toBe(10);
    expect(list.map(a => a.id)).toEqual(['a1']);
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
