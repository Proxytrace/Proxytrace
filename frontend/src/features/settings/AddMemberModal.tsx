import { useState } from 'react';
import { useLingui } from '@lingui/react/macro';
import { Modal } from '../../components/overlays/Modal';
import { Avatar } from '../../components/ui/Avatar';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import { RowButton } from '../../components/ui/RowButton';
import { SkeletonList } from '../../components/ui/Skeleton';
import { useUsers } from './hooks/useUsers';
import { colorFor, initials } from './projectsMeta';

interface AddMemberModalProps {
  excludeIds: string[];
  onPick: (userId: string) => void;
  onCancel: () => void;
  loading?: boolean;
}

export function AddMemberModal({ excludeIds, onPick, onCancel, loading }: AddMemberModalProps) {
  const { t } = useLingui();
  const [query, setQuery] = useState('');

  const { data: usersData, isLoading } = useUsers();

  const all = usersData?.items ?? [];
  const withoutExcluded = all.filter(u => !excludeIds.includes(u.id));
  const q = query.trim().toLowerCase();
  const candidates = q ? withoutExcluded.filter(u => u.email.toLowerCase().includes(q)) : withoutExcluded;

  return (
    <Modal title={t`Add member`} onClose={onCancel}>
      <Input
        autoFocus
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder={t`Search users by name…`}
        className="mb-3"
      />
      <div className="max-h-[360px] overflow-y-auto border border-hairline rounded-md" data-testid="add-member-modal">
        {isLoading ? (
          <div className="p-2"><SkeletonList rows={6} height={44} gap={4} /></div>
        ) : candidates.length === 0 ? (
          <EmptyState
            title={query ? t`No matches` : t`No users to add`}
            description={query ? t`Try a different search term.` : t`All users are already members.`}
          />
        ) : (
          candidates.map(u => (
            <RowButton
              key={u.id}
              data-testid={`add-member-candidate-${u.id}`}
              onClick={() => onPick(u.id)}
              disabled={loading}
              className="flex items-center gap-3 px-3 py-2.5 text-title border-b border-hairline last:border-b-0 hover:bg-[color-mix(in_srgb,_var(--accent-primary)_4%,_transparent)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Avatar
                initials={initials(u.email)}
                color={colorFor(u.id)}
                className="w-7 h-7 rounded-full text-caption"
              />
              <span className="flex-1 min-w-0 truncate text-primary font-semibold">{u.email}</span>
            </RowButton>
          ))
        )}
      </div>
    </Modal>
  );
}
