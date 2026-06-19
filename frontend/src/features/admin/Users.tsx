import { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useAuthMode } from '../../auth/authMode';
import { useCurrentUser } from '../../auth/useCurrentUser';
import { ConfirmDialog } from '../../components/overlays/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { SkeletonList } from '../../components/ui/Skeleton';
import type { UserDto, UserRole } from '../../api/models';
import { useDeleteUser, useUpdateUserRole, useUsers } from './hooks/useUsers';
import { InviteUserForm } from './components/InviteUserForm';
import { PendingInvitesTable } from './components/PendingInvitesTable';
import { UsersTable } from './components/UsersTable';
import { UserProjectsModal } from './components/UserProjectsModal';

export default function Users() {
  const { t } = useLingui();
  const { data: authMode } = useAuthMode();
  const currentUser = useCurrentUser();
  const { data: users, isLoading } = useUsers();
  const updateRole = useUpdateUserRole();
  const deleteUser = useDeleteUser();
  const [confirmDelete, setConfirmDelete] = useState<UserDto | null>(null);
  const [manageProjects, setManageProjects] = useState<UserDto | null>(null);

  const isLocal = authMode?.mode === 'local';

  const onChangeRole = (user: UserDto, role: UserRole) => updateRole.mutate({ id: user.id, role });
  const onConfirmDelete = () => {
    if (!confirmDelete) return;
    deleteUser.mutate(confirmDelete.id, { onSuccess: () => setConfirmDelete(null) });
  };

  return (
    <div className="space-y-8 p-6 max-w-6xl">
      <header>
        <h1 className="text-h1 font-semibold"><Trans>Users</Trans></h1>
        <p className="text-body-sm text-muted mt-1"><Trans>Manage roles, project access, and invitations.</Trans></p>
      </header>

      {isLocal && (
        <section className="space-y-3">
          <h2 className="text-h2 font-semibold"><Trans>Invite a user</Trans></h2>
          <InviteUserForm />
          <h3 className="text-title font-semibold pt-2"><Trans>Pending invites</Trans></h3>
          <PendingInvitesTable />
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-h2 font-semibold"><Trans>All users</Trans></h2>
        {isLoading ? (
          <SkeletonList rows={5} height={40} gap={6} />
        ) : !users || users.length === 0 ? (
          <div data-testid="user-empty-state">
            <EmptyState title={t`No users yet`} />
          </div>
        ) : (
          <UsersTable
            users={users}
            currentUserEmail={currentUser?.email}
            onChangeRole={onChangeRole}
            onDelete={setConfirmDelete}
            onManageProjects={setManageProjects}
          />
        )}
      </section>

      {confirmDelete && (
        <ConfirmDialog
          entityName={confirmDelete.email}
          displayName={confirmDelete.email}
          confirmLabel={t`Remove user`}
          loading={deleteUser.isPending}
          onConfirm={onConfirmDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {manageProjects && (
        <UserProjectsModal user={manageProjects} onClose={() => setManageProjects(null)} />
      )}
    </div>
  );
}
