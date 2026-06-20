import { msg } from '@lingui/core/macro';
import type { MessageDescriptor } from '@lingui/core';
import type { UserDto, UserRole } from '../../api/models';

export const USER_ROLES: readonly UserRole[] = ['Member', 'Admin'];

/** Number of users currently holding the Admin role. */
export function adminCount(users: UserDto[]): number {
  return users.filter((u) => u.role === 'Admin').length;
}

/**
 * Mirrors the backend invariant: demoting or deleting the last remaining Admin is rejected.
 * The UI disables those actions so the user never hits the 409.
 */
export function isLastAdmin(users: UserDto[], user: UserDto): boolean {
  return user.role === 'Admin' && adminCount(users) <= 1;
}

/** Short label for a user's authentication source. */
export function authSourceLabel(user: Pick<UserDto, 'isExternal'>): MessageDescriptor {
  return user.isExternal ? msg`SSO` : msg`Local`;
}
