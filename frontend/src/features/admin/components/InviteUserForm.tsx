import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import type { UserRole } from '../../../api/models';
import { useCreateInvite } from '../hooks/useInvites';
import { USER_ROLES } from '../users';

/** Admin form to invite a new local user by email; surfaces the share link on success. */
export function InviteUserForm() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('Member');
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const create = useCreateInvite();

  const submit = () =>
    create.mutate({ email, role }, { onSuccess: (r) => { setCreatedUrl(r.url); setEmail(''); } });

  const copy = async () => {
    if (!createdUrl) return;
    await navigator.clipboard.writeText(createdUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-3">
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
            onValueChange={(v) => setRole(v as UserRole)}
          >
            {USER_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
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
    </div>
  );
}
