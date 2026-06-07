import { useState } from 'react';
import type { InviteRow } from '../../api/invites';
import { SkeletonList } from '../../components/ui/Skeleton';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { useCreateInvite, useInvites, useRevokeInvite } from './hooks/useInvites';
import { inviteStatus } from './invitesMeta';

export default function Invites() {
  const { data, isLoading } = useInvites();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InviteRow['role']>('Viewer');
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const create = useCreateInvite();
  const revoke = useRevokeInvite();

  const submit = () =>
    create.mutate({ email, role }, { onSuccess: (r) => { setCreatedUrl(r.url); setEmail(''); } });

  const copy = async () => {
    if (!createdUrl) return;
    await navigator.clipboard.writeText(createdUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-lg font-semibold">Invites</h1>

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="w-64">
          <Input
            placeholder="Email"
            type="email"
            data-testid="invite-email-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="w-40">
          <Select
            data-testid="invite-role-select"
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
          >
            <option>Viewer</option>
            <option>Member</option>
            <option>Admin</option>
          </Select>
        </div>
        <Button type="submit" loading={create.isPending} data-testid="invite-create-btn">
          Create invite
        </Button>
      </form>

      {createdUrl && (
        <div className="flex items-center gap-2 rounded border border-border bg-surface p-3 text-sm">
          <span className="text-muted">Share this link:</span>
          <code className="flex-1 truncate">{createdUrl}</code>
          <Button variant="secondary" size="sm" onClick={copy}>
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>
      )}

      {isLoading ? (
        <SkeletonList rows={4} height={36} gap={6} />
      ) : (
        <table className="w-full text-sm" data-testid="invite-list">
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
            {data?.map((i) => {
              const status = inviteStatus(i);
              return (
                <tr key={i.id} data-testid={`invite-row-${i.id}`} className="border-b border-border/50">
                  <td className="py-2">{i.email}</td>
                  <td className="py-2">{i.role}</td>
                  <td className="py-2" data-testid={`invite-status-${i.id}`}>{status}</td>
                  <td className="py-2">{new Date(i.expiresAt).toLocaleString()}</td>
                  <td className="py-2 text-right">
                    {!i.consumedAt && (
                      <Button
                        variant="link"
                        data-write
                        data-testid={`invite-revoke-btn-${i.id}`}
                        onClick={() => revoke.mutate(i.id)}
                        className="text-danger hover:text-danger text-body-sm"
                      >
                        Revoke
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
            {data && data.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-muted">
                  No invites yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
