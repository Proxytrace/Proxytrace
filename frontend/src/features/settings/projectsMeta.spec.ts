import { describe, it, expect } from 'vitest';
import { initials, colorFor, endpointLabel } from './projectsMeta';

describe('initials', () => {
  it('uses first+last word for multi-word names', () => {
    expect(initials('Ada Lovelace')).toBe('AL');
    expect(initials('Jean Luc Picard')).toBe('JP');
  });
  it('uses the first two chars for a single word', () => {
    expect(initials('alice')).toBe('AL');
    expect(initials('x')).toBe('X');
  });
  it('handles emails as single tokens', () => {
    expect(initials('user@example.com')).toBe('US');
  });
  it('trims surrounding whitespace', () => {
    expect(initials('  Bob Smith  ')).toBe('BS');
  });
});

describe('colorFor', () => {
  it('returns a raw hex color from the shared avatar palette', () => {
    expect(colorFor('abc')).toMatch(/^#[0-9a-f]{6}$/i);
  });
  it('is stable for the same id', () => {
    expect(colorFor('project-1')).toBe(colorFor('project-1'));
  });
  it('spreads ids across many distinct hues (no single-hue collapse)', () => {
    const ids = Array.from({ length: 24 }, (_, i) => `entity-${i}`);
    const distinct = new Set(ids.map(colorFor));
    expect(distinct.size).toBeGreaterThan(1); // must never collapse to a single hue
    expect(distinct.size).toBeGreaterThanOrEqual(6); // genuinely distinct (palette holds 8)
  });
});

describe('endpointLabel', () => {
  const endpoints = [{ id: 'e1', providerName: 'OpenAI', modelName: 'gpt-4o' }];
  it('formats provider · model when found', () => {
    expect(endpointLabel(endpoints, 'e1')).toBe('OpenAI · gpt-4o');
  });
  it('falls back to the raw id when not found', () => {
    expect(endpointLabel(endpoints, 'missing')).toBe('missing');
  });
});
