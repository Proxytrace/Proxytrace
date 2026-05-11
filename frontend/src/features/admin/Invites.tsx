import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

interface InviteRow {
  id: string;
  email: string;
  role: 'Viewer' | 'Member' | 'Admin';
  expiresAt: string;
  consumedAt: string | null;
}

interface CreateInviteResponse {
  token: string;
  url: string;
  expiresAt: string;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  if (res.status === 204) return undefined as T;
  return res.json();
}

export default function Invites() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['invites'],
    queryFn: () => api<InviteRow[]>('/api/auth/invites'),
  });

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'Viewer' | 'Member' | 'Admin'>('Viewer');
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const create = useMutation({
    mutationFn: () =>
      api<CreateInviteResponse>('/api/auth/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      }),
    onSuccess: (r) => {
      setCreatedUrl(r.url);
      setEmail('');
      qc.invalidateQueries({ queryKey: ['invites'] });
    },
  });

  const revoke = useMutation({
    mutationFn: (id: string) => api<void>(`/api/auth/invites/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invites'] }),
  });

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
          create.mutate();
        }}
      >
        <input
          className="rounded border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <select
          className="rounded border border-border bg-bg px-3 py-2 text-sm"
          value={role}
          onChange={(e) => setRole(e.target.value as typeof role)}
        >
          <option>Viewer</option>
          <option>Member</option>
          <option>Admin</option>
        </select>
        <button
          className="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          type="submit"
          disabled={create.isPending}
        >
          {create.isPending ? 'Creating…' : 'Create invite'}
        </button>
      </form>

      {createdUrl && (
        <div className="flex items-center gap-2 rounded border border-border bg-surface p-3 text-sm">
          <span className="text-muted">Share this link:</span>
          <code className="flex-1 truncate">{createdUrl}</code>
          <button
            onClick={copy}
            className="rounded border border-border px-2 py-1 text-xs hover:bg-surface-2"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <table className="w-full text-sm">
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
              const status = i.consumedAt
                ? 'Used'
                : new Date(i.expiresAt) < new Date()
                ? 'Expired'
                : 'Pending';
              return (
                <tr key={i.id} className="border-b border-border/50">
                  <td className="py-2">{i.email}</td>
                  <td className="py-2">{i.role}</td>
                  <td className="py-2">{status}</td>
                  <td className="py-2">{new Date(i.expiresAt).toLocaleString()}</td>
                  <td className="py-2 text-right">
                    {!i.consumedAt && (
                      <button
                        onClick={() => revoke.mutate(i.id)}
                        className="text-xs text-danger hover:underline"
                      >
                        Revoke
                      </button>
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
