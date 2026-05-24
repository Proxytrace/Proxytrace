import { describe, it, expect } from 'vitest';
import { truncate, resolveGroupOrder, baseRole, ALL_GROUPS } from './searchMeta';

describe('truncate', () => {
  it('returns the string unchanged when shorter than limit', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('returns the string unchanged when exactly at limit', () => {
    expect(truncate('hello', 5)).toBe('hello');
  });

  it('truncates and appends ellipsis when over limit', () => {
    expect(truncate('hello world', 5)).toBe('hello…');
  });

  it('handles empty string', () => {
    expect(truncate('', 10)).toBe('');
  });
});

describe('resolveGroupOrder', () => {
  it('excludes testCase by default when kinds is undefined', () => {
    const result = resolveGroupOrder(undefined);
    expect(result.map(g => g.kind)).not.toContain('testCase');
  });

  it('excludes testCase by default when kinds is empty', () => {
    const result = resolveGroupOrder([]);
    expect(result.map(g => g.kind)).not.toContain('testCase');
  });

  it('includes only requested kinds when kinds is specified', () => {
    const result = resolveGroupOrder(['agent', 'testCase']);
    expect(result.map(g => g.kind)).toEqual(['agent', 'testCase']);
  });

  it('preserves ALL_GROUPS display order', () => {
    const result = resolveGroupOrder(undefined);
    const allOrder = ALL_GROUPS.map(g => g.kind);
    const resultOrder = result.map(g => g.kind);
    // Every item in result must appear in allOrder in the same relative order
    let lastIdx = -1;
    for (const kind of resultOrder) {
      const idx = allOrder.indexOf(kind);
      expect(idx).toBeGreaterThan(lastIdx);
      lastIdx = idx;
    }
  });

  it('returns empty array when requested kinds match nothing', () => {
    // @ts-expect-error intentional unknown kind
    const result = resolveGroupOrder(['unknown']);
    expect(result).toHaveLength(0);
  });
});

describe('baseRole', () => {
  it('returns plain roles as-is (lowercased)', () => {
    expect(baseRole('user')).toBe('user');
    expect(baseRole('assistant')).toBe('assistant');
    expect(baseRole('system')).toBe('system');
  });

  it('strips the expected(...) wrapper', () => {
    expect(baseRole('expected (assistant)')).toBe('assistant');
    expect(baseRole('expected (user)')).toBe('user');
  });
});
