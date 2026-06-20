import { Trans, useLingui } from '@lingui/react/macro';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import type { UserDto, UserRole } from '../../../api/models';
import { authSourceLabel, isLastAdmin } from '../users';
import { UserRoleSelect } from './UserRoleSelect';

interface UsersTableProps {
  users: UserDto[];
  currentUserEmail?: string;
  onChangeRole: (user: UserDto, role: UserRole) => void;
  onDelete: (user: UserDto) => void;
  onManageProjects: (user: UserDto) => void;
}

export function UsersTable({ users, currentUserEmail, onChangeRole, onDelete, onManageProjects }: UsersTableProps) {
  return (
    <table className="w-full text-sm" data-testid="user-list">
      <thead className="text-muted">
        <tr className="border-b border-border">
          <th className="py-2 text-left"><Trans>Email</Trans></th>
          <th className="py-2 text-left"><Trans>Role</Trans></th>
          <th className="py-2 text-left"><Trans>Sign-in</Trans></th>
          <th className="py-2 text-left"><Trans>Created</Trans></th>
          <th />
        </tr>
      </thead>
      <tbody>
        {users.map((user) => (
          <UserRow
            key={user.id}
            user={user}
            isSelf={!!currentUserEmail && user.email === currentUserEmail}
            locked={isLastAdmin(users, user)}
            onChangeRole={onChangeRole}
            onDelete={onDelete}
            onManageProjects={onManageProjects}
          />
        ))}
      </tbody>
    </table>
  );
}

interface UserRowProps {
  user: UserDto;
  isSelf: boolean;
  locked: boolean;
  onChangeRole: (user: UserDto, role: UserRole) => void;
  onDelete: (user: UserDto) => void;
  onManageProjects: (user: UserDto) => void;
}

function UserRow({ user, isSelf, locked, onChangeRole, onDelete, onManageProjects }: UserRowProps) {
  const { t, i18n } = useLingui();
  const guarded = isSelf || locked;
  const guardReason = isSelf
    ? t`You cannot change your own account.`
    : locked
      ? t`At least one Admin must remain.`
      : undefined;

  return (
    <tr data-testid={`user-row-${user.id}`} className="border-b border-border/50">
      <td className="py-2">
        <span data-testid={`user-email-${user.id}`}>{user.email}</span>
        {isSelf && <span className="ml-2 text-muted text-body-sm"><Trans>(You)</Trans></span>}
      </td>
      <td className="py-2">
        <div className="w-32" title={guarded ? guardReason : undefined}>
          <UserRoleSelect
            value={user.role}
            disabled={guarded}
            onChange={(role) => onChangeRole(user, role)}
            data-testid={`user-role-select-${user.id}`}
          />
        </div>
      </td>
      <td className="py-2">
        <Badge label={i18n._(authSourceLabel(user))} variant={user.isExternal ? 'accent' : 'neutral'} />
      </td>
      <td className="py-2 text-muted">{new Date(user.createdAt).toLocaleDateString()}</td>
      <td className="py-2">
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            data-write
            data-testid={`user-projects-btn-${user.id}`}
            onClick={() => onManageProjects(user)}
          >
            <Trans>Projects</Trans>
          </Button>
          <Button
            variant="dangerOutline"
            size="sm"
            disabled={guarded}
            title={guarded ? guardReason : undefined}
            data-testid={`user-delete-btn-${user.id}`}
            onClick={() => onDelete(user)}
          >
            <Trans>Delete</Trans>
          </Button>
        </div>
      </td>
    </tr>
  );
}
