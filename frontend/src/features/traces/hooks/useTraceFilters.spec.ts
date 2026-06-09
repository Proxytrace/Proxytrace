import { describe, it, expect } from 'vitest';
import { agentFilterKey, isValidTimeRange } from './useTraceFilters';

describe('agentFilterKey', () => {
  it('namespaces the storage key per project', () => {
    expect(agentFilterKey('proj-1')).toBe('traces.agentFilter.proj-1');
    expect(agentFilterKey('proj-2')).not.toBe(agentFilterKey('proj-1'));
  });
});

describe('isValidTimeRange', () => {
  it('accepts the three valid range shapes', () => {
    expect(isValidTimeRange({ kind: 'all' })).toBe(true);
    expect(isValidTimeRange({ kind: 'preset', preset: '24h' })).toBe(true);
    expect(isValidTimeRange({ kind: 'absolute', from: '2024-01-01T00:00:00Z', to: null })).toBe(true);
    expect(isValidTimeRange({ kind: 'absolute', from: null, to: null })).toBe(true);
  });

  it('rejects unknown kinds and malformed shapes', () => {
    expect(isValidTimeRange(null)).toBe(false);
    expect(isValidTimeRange('all')).toBe(false);
    expect(isValidTimeRange({ kind: 'bogus' })).toBe(false);
    expect(isValidTimeRange({ kind: 'preset', preset: '99y' })).toBe(false);
    expect(isValidTimeRange({ kind: 'absolute', from: 5, to: null })).toBe(false);
  });
});
