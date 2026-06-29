import { Trans } from '@lingui/react/macro';
import { Button } from '../../../components/ui/Button';
import { SkeletonList } from '../../../components/ui/Skeleton';
import { useInvites, useRevokeInvite } from '../hooks/useInvites';
import { inviteStatus } from '../invitesMeta';

/** Lists invites that are still pending (not yet redeemed or expired) with a revoke action. */
export function PendingInvitesTable() {
  const { data, isLoading } = useInvites();
  const revoke = useRevokeInvite();

  if (isLoading) {
    return <SkeletonList rows={3} height={36} gap={6} />;
  }

  // Only outstanding invites belong here — once an invite is used (or expires) it drops off.
  const pending = (data ?? []).filter((i) => inviteStatus(i) === 'Pending');

  return (
    <table className="w-full text-body" data-testid="invite-list">
      <thead className="text-muted">
        <tr className="border-b border-border">
          <th className="py-2 text-left"><Trans>Email</Trans></th>
          <th className="py-2 text-left"><Trans>Role</Trans></th>
          <th className="py-2 text-left"><Trans>Status</Trans></th>
          <th className="py-2 text-left"><Trans>Expires</Trans></th>
          <th />
        </tr>
      </thead>
      <tbody>
        {pending.map((i) => (
          <tr key={i.id} data-testid={`invite-row-${i.id}`} className="border-b border-border/50">
            <td className="py-2">{i.email}</td>
            <td className="py-2">{i.role}</td>
            <td className="py-2" data-testid={`invite-status-${i.id}`}><Trans>Pending</Trans></td>
            <td className="py-2 text-muted">{new Date(i.expiresAt).toLocaleString()}</td>
            <td className="py-2">
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="link"
                  data-write
                  data-testid={`invite-revoke-btn-${i.id}`}
                  onClick={() => revoke.mutate(i.id)}
                  className="text-danger hover:text-danger text-body-sm"
                >
                  <Trans>Revoke</Trans>
                </Button>
              </div>
            </td>
          </tr>
        ))}
        {pending.length === 0 && (
          <tr>
            <td colSpan={5} className="py-6 text-center text-muted">
              <Trans>No pending invites.</Trans>
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
