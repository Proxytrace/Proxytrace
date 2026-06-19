import { describe, expect, it } from 'vitest';
import { isPresented } from './present-gate';

// `isPresented` is the whole decision behind card density: a read result becomes a full card only
// when the model explicitly set `present: true`. Everything else stays a quiet one-line trace.
describe('isPresented', () => {
  it('is true only when present === true', () => {
    expect(isPresented({ present: true })).toBe(true);
  });

  it('defaults to false when the model omits the flag', () => {
    expect(isPresented({})).toBe(false);
    expect(isPresented({ agentId: 'a1' })).toBe(false);
  });

  it('is false for an explicit false', () => {
    expect(isPresented({ present: false })).toBe(false);
  });

  it('treats a missing/streaming args object as not presented', () => {
    expect(isPresented(undefined)).toBe(false);
    expect(isPresented(null)).toBe(false);
  });

  it('ignores a non-boolean present value (only a real true opts in)', () => {
    expect(isPresented({ present: 'true' })).toBe(false);
    expect(isPresented({ present: 1 })).toBe(false);
  });
});
