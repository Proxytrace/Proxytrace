import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal } from '../../components/overlays/Modal';
import { Avatar } from '../../components/ui/Avatar';
import { EmptyState } from '../../components/ui/EmptyState';
import { SkeletonList } from '../../components/ui/Skeleton';
import { QUERY_KEYS } from '../../api/query-keys';
import { usersApi } from '../../api/users';
import { LIST_PAGE_SIZE } from '../../lib/constants';
import { formInputCls } from '../../components/ui/classes';

interface AddMemberModalProps {
  excludeIds: string[];
  onPick: (userId: string) => void;
  onCancel: () => void;
  loading?: boolean;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function colorFor(id: string): string {
  const palette = ['var(--accent-primary)', 'var(--success)', 'var(--teal)', 'var(--teal)', 'var(--warn)', 'var(--accent-hover)'];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

export function AddMemberModal({ excludeIds, onPick, onCancel, loading }: AddMemberModalProps) {
  const [query, setQuery] = useState('');

  const { data: usersData, isLoading } = useQuery({
    queryKey: QUERY_KEYS.users,
    queryFn: () => usersApi.list({ pageSize: LIST_PAGE_SIZE }),
  });

  const all = usersData?.items ?? [];
  const withoutExcluded = all.filter(u => !excludeIds.includes(u.id));
  const q = query.trim().toLowerCase();
  const candidates = q ? withoutExcluded.filter(u => u.email.toLowerCase().includes(q)) : withoutExcluded;

  return (
    <Modal title="Add member" onClose={onCancel}>
      <input
        autoFocus
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search users by name…"
        className={`${formInputCls} mb-3`}
      />
      <div className="max-h-[360px] overflow-y-auto border border-hairline rounded-[10px]" data-testid="add-member-modal">
        {isLoading ? (
          <div className="p-2"><SkeletonList rows={6} height={44} gap={4} /></div>
        ) : candidates.length === 0 ? (
          <EmptyState
            title={query ? 'No matches' : 'No users to add'}
            description={query ? 'Try a different search term.' : 'All users are already members.'}
          />
        ) : (
          candidates.map(u => (
            <button
              key={u.id}
              type="button"
              data-testid={`add-member-candidate-${u.id}`}
              onClick={() => onPick(u.id)}
              disabled={loading}
              className="flex items-center gap-3 w-full px-3 py-[10px] text-left text-[13px] bg-transparent border-none border-b border-hairline last:border-b-0 cursor-pointer hover:bg-[color-mix(in_srgb,_var(--accent-primary)_4%,_transparent)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Avatar
                initials={initials(u.email)}
                color={colorFor(u.id)}
                className="w-7 h-7 rounded-md text-[10px]"
              />
              <span className="text-primary font-semibold">{u.email}</span>
            </button>
          ))
        )}
      </div>
    </Modal>
  );
}
