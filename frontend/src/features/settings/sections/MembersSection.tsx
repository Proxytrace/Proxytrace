import { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import type { ProjectMemberDto } from '../../../api/models';
import useCurrentProject from '../../../hooks/useCurrentProject';
import { Button, IconButton } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { SkeletonList } from '../../../components/ui/Skeleton';
import { Avatar } from '../../../components/ui/Avatar';
import { ConfirmDialog } from '../../../components/overlays/ConfirmDialog';
import { PlusIcon, TrashIcon } from '../../../components/icons';
import { initials, colorFor } from '../projectsMeta';
import { useProject, useAddMember, useRemoveMember } from '../hooks/useProjects';
import { AddMemberModal } from '../AddMemberModal';
import { SectionHeader } from '../components/SectionHeader';

/** Membership of the active project: add and remove users. */
export function MembersSection() {
  const { t } = useLingui();
  const { currentProjectId } = useCurrentProject();
  const { data: project, isLoading } = useProject(currentProjectId);

  const [showAdd, setShowAdd] = useState(false);
  const [removing, setRemoving] = useState<ProjectMemberDto | null>(null);

  const addMember = useAddMember();
  const removeMember = useRemoveMember();

  if (!currentProjectId) {
    return (
      <EmptyState
        title={t`No project selected`}
        description={t`Create a project in the Projects section to manage its members.`}
      />
    );
  }

  return (
    <div className="w-full min-w-0 flex flex-col" data-testid="settings-members">
      <SectionHeader
        title={t`Members`}
        subtitle={t`Users with access to the active project.`}
        action={
          <Button
            variant="secondary"
            size="sm"
            data-write
            data-testid="add-member-btn"
            leftIcon={<PlusIcon size={12} />}
            onClick={() => setShowAdd(true)}
            disabled={!project}
          >
            <Trans>Add member</Trans>
          </Button>
        }
      />

      <div className="max-w-[760px]">
        {isLoading || !project ? (
          <SkeletonList rows={4} height={48} gap={8} />
        ) : project.members.length === 0 ? (
          <EmptyState title={t`No members yet`} description={t`Add users to this project to grant them access.`} />
        ) : (
          <div className="border border-hairline rounded-lg overflow-hidden" data-testid="member-list">
            {project.members.map(m => (
              <div
                key={m.id}
                data-testid={`member-row-${m.id}`}
                className="flex items-center gap-3 px-3 py-2.5 border-b border-hairline last:border-b-0"
              >
                <Avatar initials={initials(m.email)} color={colorFor(m.id)} className="w-7 h-7 rounded-full text-caption" />
                <span className="flex-1 text-title font-semibold text-primary truncate">{m.email}</span>
                <IconButton
                  data-write
                  aria-label={t`Remove ${m.email}`}
                  className="text-muted hover:text-danger"
                  onClick={() => setRemoving(m)}
                >
                  <TrashIcon size={14} />
                </IconButton>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && project && (
        <AddMemberModal
          excludeIds={project.members.map(m => m.id)}
          onCancel={() => setShowAdd(false)}
          onPick={userId => addMember.mutate({ projectId: project.id, userId }, { onSuccess: () => setShowAdd(false) })}
          loading={addMember.isPending}
        />
      )}
      {removing && project && (
        <ConfirmDialog
          entityName={removing.email}
          onCancel={() => setRemoving(null)}
          onConfirm={() => removeMember.mutate({ projectId: project.id, userId: removing.id }, { onSuccess: () => setRemoving(null) })}
          loading={removeMember.isPending}
        />
      )}
    </div>
  );
}
