import { useState } from 'react';
import type { InviteRow } from '../../../api/invites';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { FormField } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { useCreateInvite } from '../hooks/useInvites';

export function InviteCreateForm() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InviteRow['role']>('Viewer');
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const create = useCreateInvite();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    create.mutate(
      { email, role },
      {
        onSuccess: (r) => {
          setCreatedUrl(r.url);
          setEmail('');
        },
      },
    );
  };

  const copy = async () => {
    if (!createdUrl) return;
    await navigator.clipboard.writeText(createdUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-4">
      <form className="flex flex-wrap items-end gap-3" onSubmit={submit}>
        <FormField label="Email" className="min-w-[16rem] flex-1">
          <Input
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </FormField>
        <FormField label="Role">
          <Select value={role} onChange={(e) => setRole(e.target.value as InviteRow['role'])}>
            <option>Viewer</option>
            <option>Member</option>
            <option>Admin</option>
          </Select>
        </FormField>
        <Button type="submit" variant="primary" loading={create.isPending} data-write>
          {create.isPending ? 'Creating…' : 'Create invite'}
        </Button>
      </form>

      {createdUrl && (
        <Card elevation="flat" padding="sm" className="flex items-center gap-2">
          <span className="text-body-sm text-muted">Share this link:</span>
          <code className="flex-1 truncate font-mono text-body-sm text-primary">{createdUrl}</code>
          <Button variant="secondary" size="sm" onClick={copy}>
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </Card>
      )}
    </div>
  );
}
