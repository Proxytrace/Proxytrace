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
  it('returns a token from the palette', () => {
    expect(colorFor('abc')).toMatch(/^var\(--/);
  });
  it('is stable for the same id', () => {
    expect(colorFor('project-1')).toBe(colorFor('project-1'));
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
