import { describe, it, expect } from 'vitest';
import { agentColor, projectColor, providerColor, modelColor } from './colors';

const HEX = /^#[0-9a-f]{6}$/i;

// A deterministic id sweep wide enough to hit every hash bucket (hash % 8).
const IDS = Array.from({ length: 1000 }, (_, i) => `entity-${i}`);

describe('agentColor', () => {
  it('is stable for the same id', () => {
    expect(agentColor('agent-42')).toBe(agentColor('agent-42'));
  });

  it('always returns a valid 6-digit hex', () => {
    for (const id of IDS) expect(agentColor(id)).toMatch(HEX);
  });

  // Regression for #301: the palette used to carry duplicates/near-identical golds, so unrelated
  // agents collapsed onto ~3 effective hues. The hash-assigned color must draw from 8 genuinely
  // distinct values (this assertion sees 5 against the pre-fix palette).
  it('draws from 8 mutually distinct hues', () => {
    const distinct = new Set(IDS.map(agentColor));
    expect(distinct.size).toBe(8);
  });
});

describe('projectColor / providerColor', () => {
  it('share the agent palette and stay valid hex', () => {
    expect(projectColor('proj-1')).toMatch(HEX);
    expect(providerColor('Cohere')).toMatch(HEX);
    expect(new Set(IDS.map(projectColor)).size).toBe(8);
  });

  it('map known providers to their fixed brand color', () => {
    expect(providerColor('OpenAI')).toBe('#57c4d3');
    expect(providerColor('Anthropic')).toBe('#5aba80');
  });
});

describe('modelColor', () => {
  it('returns the explicit color for a known model', () => {
    expect(modelColor('gpt-4o')).toBe('#57c4d3');
    expect(modelColor('claude-3.5-sonnet')).toBe('#5aba80');
  });

  it('falls back to a valid hex for an unknown model', () => {
    expect(modelColor('some-unheard-of-model')).toMatch(HEX);
  });
});
