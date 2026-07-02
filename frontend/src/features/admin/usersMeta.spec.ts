import { beforeAll, describe, expect, it } from 'vitest';
import { i18n } from '../../i18n';
import type { UserDto } from '../../api/models';
import { adminCount, authSourceLabel, isLastAdmin } from './usersMeta';

// Activate an empty catalog so i18n._() resolves MessageDescriptors to their source strings.
beforeAll(() => i18n.loadAndActivate({ locale: 'en', messages: {} }));

function user(overrides: Partial<UserDto>): UserDto {
  return {
    id: crypto.randomUUID(),
    email: 'u@example.test',
    role: 'Member',
    isExternal: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    mfaEnabled: false,
    ...overrides,
  };
}

describe('adminCount', () => {
  it('counts only Admin users', () => {
    const users = [user({ role: 'Admin' }), user({ role: 'Member' }), user({ role: 'Admin' })];
    expect(adminCount(users)).toBe(2);
  });
});

describe('isLastAdmin', () => {
  it('is true for the only admin', () => {
    const admin = user({ role: 'Admin' });
    expect(isLastAdmin([admin, user({ role: 'Member' })], admin)).toBe(true);
  });

  it('is false when another admin exists', () => {
    const admin = user({ role: 'Admin' });
    expect(isLastAdmin([admin, user({ role: 'Admin' })], admin)).toBe(false);
  });

  it('is false for a non-admin', () => {
    const member = user({ role: 'Member' });
    expect(isLastAdmin([member], member)).toBe(false);
  });
});

describe('authSourceLabel', () => {
  it('labels external users SSO and local users Local', () => {
    expect(i18n._(authSourceLabel({ isExternal: true }))).toBe('SSO');
    expect(i18n._(authSourceLabel({ isExternal: false }))).toBe('Local');
  });
});
