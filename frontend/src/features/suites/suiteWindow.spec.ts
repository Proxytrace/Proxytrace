import { beforeAll, describe, it, expect } from 'vitest';
import { i18n } from '../../i18n';
import { SUITE_WINDOW_KEYS, suiteWindowLabel, suiteWindowRange } from './suiteWindow';

// Activate an empty catalog so i18n._() resolves MessageDescriptors to their source strings.
beforeAll(() => i18n.loadAndActivate({ locale: 'en', messages: {} }));

describe('suiteWindow', () => {
  it('exposes the four bucket keys in order', () => {
    expect(SUITE_WINDOW_KEYS).toEqual(['last', '7d', '30d', 'all']);
  });

  it('all-time has no bounds', () => {
    expect(suiteWindowRange('all', '2026-01-01T00:00:00Z')).toEqual({ from: undefined, to: undefined });
  });

  it('7d/30d set a from bound and no to bound', () => {
    expect(suiteWindowRange('7d', null).to).toBeUndefined();
    expect(typeof suiteWindowRange('7d', null).from).toBe('string');
    expect(typeof suiteWindowRange('30d', null).from).toBe('string');
  });

  it('last-run window starts at lastRunAt; empty (from===to) when never run', () => {
    const r = suiteWindowRange('last', '2026-01-01T00:00:00Z');
    expect(r.from).toBe('2026-01-01T00:00:00Z');
    const none = suiteWindowRange('last', null);
    expect(none.from).toBe(none.to);
  });

  it('labels every key', () => {
    SUITE_WINDOW_KEYS.forEach(k => expect(i18n._(suiteWindowLabel(k)).length).toBeGreaterThan(0));
  });
});
