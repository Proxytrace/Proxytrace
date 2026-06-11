import { describe, expect, it } from 'vitest';
import { artifactEnvelopeOf } from './useArtifact';

describe('artifactEnvelopeOf', () => {
  it('extracts the reference and kind from a store envelope', () => {
    expect(artifactEnvelopeOf({ artifactRef: 'r1', kind: 'agent', summary: {} }))
      .toEqual({ ref: 'r1', kind: 'agent' });
  });

  it('tolerates an envelope without a kind (legacy / malformed)', () => {
    expect(artifactEnvelopeOf({ artifactRef: 'r1' })).toEqual({ ref: 'r1', kind: '' });
  });

  it('returns undefined for inline results and non-objects', () => {
    expect(artifactEnvelopeOf([{ id: 'a1' }])).toBeUndefined();
    expect(artifactEnvelopeOf({ notFound: 'x' })).toBeUndefined();
    expect(artifactEnvelopeOf(null)).toBeUndefined();
    expect(artifactEnvelopeOf('text')).toBeUndefined();
    expect(artifactEnvelopeOf({ artifactRef: 42 })).toBeUndefined();
  });
});
