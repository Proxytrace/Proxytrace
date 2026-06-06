import type { InviteRow } from '../../api/invites';

export type InviteStatus = 'Used' | 'Expired' | 'Pending';

/**
 * Derives the display status of an invite: consumed invites are "Used", otherwise
 * an expiry in the past is "Expired", and anything still in the future is "Pending".
 */
export function inviteStatus(
  invite: Pick<InviteRow, 'consumedAt' | 'expiresAt'>,
  now: Date = new Date(),
): InviteStatus {
  if (invite.consumedAt) return 'Used';
  return new Date(invite.expiresAt) < now ? 'Expired' : 'Pending';
}
