import { describe, it, expect } from 'vitest';
import { inviteStatus } from './invitesMeta';

const NOW = new Date('2026-06-04T12:00:00Z');

describe('inviteStatus', () => {
  it('returns "Used" when the invite was consumed, regardless of expiry', () => {
    expect(inviteStatus({ consumedAt: '2026-06-01T00:00:00Z', expiresAt: '2026-01-01T00:00:00Z' }, NOW))
      .toBe('Used');
  });

  it('returns "Expired" for an unconsumed invite whose expiry is in the past', () => {
    expect(inviteStatus({ consumedAt: null, expiresAt: '2026-06-03T12:00:00Z' }, NOW))
      .toBe('Expired');
  });

  it('returns "Pending" for an unconsumed invite whose expiry is in the future', () => {
    expect(inviteStatus({ consumedAt: null, expiresAt: '2026-06-05T12:00:00Z' }, NOW))
      .toBe('Pending');
  });
});
