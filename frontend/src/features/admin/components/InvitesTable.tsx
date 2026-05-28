import type { InviteRow } from '../../../api/invites';
import { Button } from '../../../components/ui/Button';
import { SkeletonList } from '../../../components/ui/Skeleton';
import { useRevokeInvite } from '../hooks/useInvites';

interface InvitesTableProps {
  invites: InviteRow[];
  loading: boolean;
}

function inviteStatus(invite: InviteRow): 'Used' | 'Expired' | 'Pending' {
  if (invite.consumedAt) return 'Used';
  if (new Date(invite.expiresAt) < new Date()) return 'Expired';
  return 'Pending';
}

export function InvitesTable({ invites, loading }: InvitesTableProps) {
  const revoke = useRevokeInvite();

  if (loading) {
    return <SkeletonList rows={4} height={36} gap={6} />;
  }

  return (
    <table className="w-full text-body">
      <thead className="text-muted">
        <tr className="border-b border-border">
          <th className="py-2 text-left">Email</th>
          <th className="py-2 text-left">Role</th>
          <th className="py-2 text-left">Status</th>
          <th className="py-2 text-left">Expires</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {invites.map((i) => (
          <tr key={i.id} className="border-b border-border/50">
            <td className="py-2">{i.email}</td>
            <td className="py-2">{i.role}</td>
            <td className="py-2">{inviteStatus(i)}</td>
            <td className="py-2">{new Date(i.expiresAt).toLocaleString()}</td>
            <td className="py-2 text-right">
              {!i.consumedAt && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-danger"
                  onClick={() => revoke.mutate(i.id)}
                  data-write
                >
                  Revoke
                </Button>
              )}
            </td>
          </tr>
        ))}
        {invites.length === 0 && (
          <tr>
            <td colSpan={5} className="py-6 text-center text-muted">
              No invites yet.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
