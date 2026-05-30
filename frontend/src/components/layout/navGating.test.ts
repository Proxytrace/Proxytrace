import { describe, it, expect } from 'vitest';
import { isNavEntryLocked } from './navGating';
import type { LicenseFeature } from '../../api/license';

describe('isNavEntryLocked', () => {
  it('is never locked when the entry requires no feature', () => {
    expect(isNavEntryLocked(undefined, [])).toBe(false);
    expect(isNavEntryLocked(undefined, ['OptimizationProposals'])).toBe(false);
  });

  it('locks a gated entry on the Free tier (no features granted)', () => {
    expect(isNavEntryLocked('OptimizationProposals', [])).toBe(true);
  });

  it('unlocks a gated entry when the license grants the feature', () => {
    const features: LicenseFeature[] = ['OptimizationProposals', 'AgenticEvaluators'];
    expect(isNavEntryLocked('OptimizationProposals', features)).toBe(false);
  });

  it('stays locked when the license grants other, unrelated features', () => {
    expect(isNavEntryLocked('OptimizationProposals', ['AgenticEvaluators'])).toBe(true);
  });
});
