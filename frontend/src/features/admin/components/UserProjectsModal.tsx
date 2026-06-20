import { useLingui } from '@lingui/react/macro';
import { Modal } from '../../../components/overlays/Modal';
import { Checkbox } from '../../../components/ui/Checkbox';
import { EmptyState } from '../../../components/ui/EmptyState';
import { SkeletonList } from '../../../components/ui/Skeleton';
import type { UserDto } from '../../../api/models';
import { useAllProjects, useAssignUserProject, useUnassignUserProject, useUserProjects } from '../hooks/useUsers';

interface UserProjectsModalProps {
  user: UserDto;
  onClose: () => void;
}

/** Per-user editor to assign/unassign the user across every project. */
export function UserProjectsModal({ user, onClose }: UserProjectsModalProps) {
  const { t } = useLingui();
  const { data: projects, isLoading } = useAllProjects();
  const { data: memberships } = useUserProjects(user.id);
  const assign = useAssignUserProject(user.id);
  const unassign = useUnassignUserProject(user.id);

  const memberIds = new Set((memberships ?? []).map((p) => p.id));
  const busy = assign.isPending || unassign.isPending;

  const toggle = (projectId: string, checked: boolean) =>
    checked ? assign.mutate(projectId) : unassign.mutate(projectId);

  return (
    <Modal title={t`Projects — ${user.email}`} onClose={onClose}>
      <div className="max-h-[360px] overflow-y-auto" data-testid="user-projects-modal">
        {isLoading ? (
          <SkeletonList rows={5} height={36} gap={4} />
        ) : !projects || projects.length === 0 ? (
          <EmptyState title={t`No projects`} description={t`Create a project first to assign members.`} />
        ) : (
          <div className="flex flex-col gap-1">
            {projects.map((p) => (
              <Checkbox
                key={p.id}
                label={p.name}
                checked={memberIds.has(p.id)}
                disabled={busy}
                data-testid={`user-project-toggle-${p.id}`}
                onChange={(e) => toggle(p.id, e.target.checked)}
                className="px-2 py-1.5 rounded-sm hover:bg-card-2"
              />
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
