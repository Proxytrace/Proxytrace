import { describe, it, expect } from 'vitest';
import type { AgentAnomalyStatDto } from '../../api/models';
import {
  buildDenseTimeline,
  rankAgents,
  resolveTimelineWindow,
  toStackedData,
  totalAnomalies,
  MAX_BUCKETS,
} from './anomaliesMeta';

const A = 'agent-a';
const B = 'agent-b';

function row(bucketStart: string, agentId: string, staticCount: number, customCount: number): AgentAnomalyStatDto {
  return { bucketStart, agentId, staticCount, customCount };
}

describe('buildDenseTimeline', () => {
  it('fills empty buckets between sparse cells (daily)', () => {
    const from = '2026-07-01T00:00:00Z';
    const to = '2026-07-04T00:00:00Z';
    const rows = [row('2026-07-01T00:00:00Z', A, 2, 0), row('2026-07-03T00:00:00Z', A, 1, 1)];
    const { buckets, truncated } = buildDenseTimeline(rows, from, to, 'daily');
    expect(truncated).toBe(false);
    expect(buckets).toHaveLength(3); // 1st, 2nd, 3rd
    expect(buckets[0].total).toBe(2);
    expect(buckets[1].total).toBe(0); // 2nd — gap
    expect(buckets[1].cells).toHaveLength(0);
    expect(buckets[2].total).toBe(2); // static 1 + custom 1
  });

  it('matches rows to buckets by epoch despite ISO-format differences', () => {
    const from = '2026-07-01T00:00:00Z';
    const to = '2026-07-02T00:00:00Z';
    // Offset-style timestamp (as the backend serializes DateTimeOffset) must still land in the bucket.
    const rows = [row('2026-07-01T00:00:00+00:00', A, 3, 0)];
    const { buckets } = buildDenseTimeline(rows, from, to, 'daily');
    expect(buckets).toHaveLength(1);
    expect(buckets[0].total).toBe(3);
  });

  it('floors off-boundary row timestamps into the aligned bucket and sums collisions', () => {
    const from = '2026-07-01T00:00:00Z';
    const to = '2026-07-01T01:00:00Z';
    const rows = [row('2026-07-01T00:12:00Z', A, 1, 0), row('2026-07-01T00:47:00Z', A, 2, 0)];
    const { buckets } = buildDenseTimeline(rows, from, to, 'hourly');
    expect(buckets).toHaveLength(1);
    expect(buckets[0].cells).toHaveLength(1);
    expect(buckets[0].cells[0].staticCount).toBe(3);
  });

  it('keeps per-agent cells separate and sorted deterministically', () => {
    const from = '2026-07-01T00:00:00Z';
    const to = '2026-07-01T00:05:00Z';
    const rows = [row('2026-07-01T00:00:00Z', B, 1, 0), row('2026-07-01T00:00:00Z', A, 2, 0)];
    const { buckets } = buildDenseTimeline(rows, from, to, 'fiveMinutes');
    expect(buckets[0].cells.map(c => c.agentId)).toEqual([A, B]);
  });

  it('returns nothing for a degenerate window', () => {
    expect(buildDenseTimeline([], '2026-07-02T00:00:00Z', '2026-07-01T00:00:00Z', 'daily').buckets).toEqual([]);
    expect(buildDenseTimeline([], 'not-a-date', '2026-07-01T00:00:00Z', 'daily').buckets).toEqual([]);
  });

  it('caps at MAX_BUCKETS and flags truncation, keeping the most recent buckets', () => {
    const from = '2020-01-01T00:00:00Z';
    const to = new Date(Date.parse(from) + (MAX_BUCKETS + 50) * 86_400_000).toISOString();
    const { buckets, truncated } = buildDenseTimeline([], from, to, 'daily');
    expect(truncated).toBe(true);
    expect(buckets).toHaveLength(MAX_BUCKETS);
    // Most-recent retained: last bucket sits one step below `to`.
    expect(buckets[buckets.length - 1].startMs).toBe(Date.parse(to) - 86_400_000);
  });
});

describe('toStackedData', () => {
  it('produces one datum per bucket and one colored segment per agent cell', () => {
    const { buckets } = buildDenseTimeline(
      [row('2026-07-01T00:00:00Z', A, 2, 1), row('2026-07-01T00:00:00Z', B, 1, 0)],
      '2026-07-01T00:00:00Z',
      '2026-07-02T00:00:00Z',
      'daily',
    );
    const data = toStackedData(buckets, 'daily', {
      color: id => `#${id}`,
      segmentLabel: c => `${c.agentId}:${c.staticCount}/${c.customCount}`,
    });
    expect(data).toHaveLength(1);
    expect(data[0].segments).toHaveLength(2);
    expect(data[0].segments[0]).toEqual({ value: 3, color: `#${A}`, label: `${A}:2/1` });
    expect(data[0].segments[1]).toEqual({ value: 1, color: `#${B}`, label: `${B}:1/0` });
  });
});

describe('rankAgents', () => {
  it('ranks agents by total flagged calls desc and caps at the limit', () => {
    const rows = [
      row('2026-07-01T00:00:00Z', A, 1, 1),
      row('2026-07-02T00:00:00Z', A, 1, 0),
      row('2026-07-01T00:00:00Z', B, 5, 0),
    ];
    const ranked = rankAgents(rows);
    expect(ranked.map(r => r.agentId)).toEqual([B, A]);
    expect(ranked[0]).toMatchObject({ total: 5, staticTotal: 5, customTotal: 0 });
    expect(ranked[1]).toMatchObject({ total: 3, staticTotal: 2, customTotal: 1 });
  });

  it('drops zero-total agents and respects the limit', () => {
    const rows = [row('2026-07-01T00:00:00Z', A, 0, 0), row('2026-07-01T00:00:00Z', B, 2, 0)];
    expect(rankAgents(rows, 1).map(r => r.agentId)).toEqual([B]);
  });
});

describe('totalAnomalies', () => {
  it('sums static and custom counts across all rows', () => {
    expect(totalAnomalies([row('t', A, 2, 3), row('t', B, 1, 0)])).toBe(6);
  });
});

describe('resolveTimelineWindow', () => {
  const now = Date.UTC(2026, 6, 3, 12, 0, 0);

  it('resolves a preset to a from..now window', () => {
    const { from, to } = resolveTimelineWindow({ kind: 'preset', preset: '24h' }, now);
    expect(Date.parse(to)).toBe(now);
    expect(now - Date.parse(from)).toBe(24 * 60 * 60_000);
  });

  it('falls back to a 30-day window for the all-time range', () => {
    const { from, to } = resolveTimelineWindow({ kind: 'all' }, now);
    expect(Date.parse(to)).toBe(now);
    expect(now - Date.parse(from)).toBe(30 * 24 * 60 * 60_000);
  });

  it('honours an explicit absolute window', () => {
    const range = { kind: 'absolute', from: '2026-07-01T00:00:00Z', to: '2026-07-02T00:00:00Z' } as const;
    const { from, to } = resolveTimelineWindow(range, now);
    expect(from).toBe('2026-07-01T00:00:00Z');
    expect(to).toBe('2026-07-02T00:00:00Z');
  });
});
