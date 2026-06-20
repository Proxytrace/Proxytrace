import { useState } from 'react';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import type { ProjectListItemDto } from '../../../api/models';
import useCurrentProject from '../../../hooks/useCurrentProject';
import { Button, IconButton } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { RowButton } from '../../../components/ui/RowButton';
import { SkeletonList } from '../../../components/ui/Skeleton';
import { Avatar } from '../../../components/ui/Avatar';
import { Badge } from '../../../components/ui/Badge';
import { ConfirmDialog } from '../../../components/overlays/ConfirmDialog';
import { PlusIcon, TrashIcon } from '../../../components/icons';
import { initials, colorFor } from '../projectsMeta';
import { useCreateProject, useDeleteProject } from '../hooks/useProjects';
import useModelEndpoints from '../../../hooks/useModelEndpoints';
import { NewProjectModal } from '../NewProjectModal';
import { SectionHeader } from '../components/SectionHeader';

/**
 * Workspace-level project management: list every project, create new ones, delete, and switch the
 * active project. "Active" here is the single source of truth shared with the sidebar switcher
 * (ProjectProvider) — the project the project-scoped sections (General/Members/Search) act on.
 */
export function ProjectsSection() {
  const { t } = useLingui();
  const { projects, currentProjectId, setCurrentProjectId, isLoading } = useCurrentProject();
  const { data: endpoints = [] } = useModelEndpoints();

  const [showNew, setShowNew] = useState(false);
  const [removing, setRemoving] = useState<ProjectListItemDto | null>(null);

  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();

  return (
    <div className="w-full min-w-0 flex flex-col" data-testid="settings-projects">
      <SectionHeader
        title={t`Projects`}
        subtitle={t`Create, switch, and delete projects across the workspace.`}
        action={
          <Button
            variant="primary"
            size="sm"
            data-testid="project-create-btn"
            leftIcon={<PlusIcon size={14} />}
            onClick={() => setShowNew(true)}
          >
            <Trans>New project</Trans>
          </Button>
        }
      />

      <div className="max-w-[760px]">
        {isLoading ? (
          <SkeletonList rows={4} height={52} gap={8} />
        ) : projects.length === 0 ? (
          <EmptyState title={t`No projects yet`} description={t`Create your first project to get started.`} />
        ) : (
          <div className="border border-hairline rounded-[12px] overflow-hidden" data-testid="project-list">
            {projects.map(p => {
              const active = p.id === currentProjectId;
              return (
                <div
                  key={p.id}
                  data-testid={`project-row-${p.id}`}
                  className="flex items-center gap-3 px-3 py-[10px] border-b border-hairline last:border-b-0"
                >
                  <RowButton
                    data-write
                    data-testid={`project-switch-btn-${p.id}`}
                    onClick={() => setCurrentProjectId(p.id)}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left rounded-md hover:bg-white/[.03] -mx-1 px-1 py-1"
                  >
                    <Avatar initials={initials(p.name)} color={colorFor(p.id)} className="w-7 h-7 rounded-md text-[10px]" />
                    <span className="flex flex-col min-w-0">
                      <span className="text-title font-semibold text-primary truncate">{p.name}</span>
                      <span className="text-body-sm text-muted">
                        <Plural value={p.memberCount} one="# member" other="# members" />
                      </span>
                    </span>
                  </RowButton>
                  {active && (
                    <span data-testid={`project-active-${p.id}`}>
                      <Badge variant="accent" label={t`Active`} />
                    </span>
                  )}
                  <IconButton
                    data-write
                    aria-label={t`Delete ${p.name}`}
                    data-testid={`project-delete-btn-${p.id}`}
                    className="text-muted hover:text-danger"
                    onClick={() => setRemoving(p)}
                  >
                    <TrashIcon size={14} />
                  </IconButton>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showNew && (
        <NewProjectModal
          endpoints={endpoints}
          onCancel={() => setShowNew(false)}
          onSubmit={req => createProject.mutate(req, {
            onSuccess: p => { setShowNew(false); setCurrentProjectId(p.id); },
          })}
          loading={createProject.isPending}
        />
      )}
      {removing && (
        <ConfirmDialog
          entityName={removing.name}
          onCancel={() => setRemoving(null)}
          onConfirm={() => deleteProject.mutate(removing.id, { onSuccess: () => setRemoving(null) })}
          loading={deleteProject.isPending}
        />
      )}
    </div>
  );
}
