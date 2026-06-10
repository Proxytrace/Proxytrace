import { useState } from 'react';
import type { ProjectMemberDto } from '../../api/models';
import { ConfirmDialog } from '../../components/overlays/ConfirmDialog';
import { Button, IconButton } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { RowButton } from '../../components/ui/RowButton';
import { SkeletonList } from '../../components/ui/Skeleton';
import { Avatar } from '../../components/ui/Avatar';
import { FormField } from '../../components/ui/FormField';
import { PlusIcon, TrashIcon, EditIcon, CheckIcon, XIcon } from '../../components/icons';
import { fmtDate } from '../../lib/format';
import { NewProjectModal } from './NewProjectModal';
import { AddMemberModal } from './AddMemberModal';
import { initials, colorFor, endpointLabel } from './projectsMeta';
import {
  useModelEndpoints, useProject,
  useCreateProject, useUpdateProject, useDeleteProject, useAddMember, useRemoveMember,
} from './hooks/useProjects';
import { useProjectSelection } from './hooks/useProjectSelection';

export function ProjectsTab() {
  const { setSelectedId, search, setSearch, projects, filtered, effectiveId, projectsLoading } =
    useProjectSelection();

  const [showNew, setShowNew] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [removeMember, setRemoveMember] = useState<ProjectMemberDto | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [editName, setEditName] = useState(false);
  const [editEndpoint, setEditEndpoint] = useState(false);

  const { data: endpoints = [] } = useModelEndpoints();

  const { data: selected } = useProject(effectiveId);

  const [nameDraft, setNameDraft] = useState(selected?.name ?? '');
  const [endpointDraft, setEndpointDraft] = useState(selected?.systemEndpointId ?? '');

  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const addMember = useAddMember();
  const removeMemberMut = useRemoveMember();

  const finishEdit = () => { setEditName(false); setEditEndpoint(false); };

  return (
    <div className="grid grid-cols-[320px_1fr] gap-3 flex-1 min-h-0" data-testid="projects-tab">
      {/* List */}
      <aside className="flex flex-col bg-card border border-hairline rounded-[14px] overflow-hidden">
        <div className="p-3 border-b border-hairline shrink-0 flex flex-col gap-2">
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects…" />
          <Button
            variant="primary"
            size="sm"
            fullWidth
            data-testid="project-create-btn"
            leftIcon={<PlusIcon size={14} />}
            onClick={() => setShowNew(true)}
          >
            New project
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {projectsLoading ? (
            <div className="p-2"><SkeletonList rows={5} height={44} gap={4} /></div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-[13px] text-muted text-center">No projects.</div>
          ) : (
            filtered.map(p => {
              const isActive = p.id === effectiveId;
              return (
                <RowButton
                  key={p.id}
                  data-testid={`project-row-${p.id}`}
                  onClick={() => setSelectedId(p.id)}
                  className={`flex flex-col items-start gap-0.5 px-3 py-[10px] border-b border-hairline ${
                    isActive ? 'bg-[color-mix(in_srgb,_var(--accent-primary)_6%,_transparent)]' : 'hover:bg-[color-mix(in_srgb,_var(--accent-primary)_4%,_transparent)]'
                  }`}
                >
                  <span className="text-[13px] font-semibold text-primary">{p.name}</span>
                  <span className="text-[11px] text-muted" data-testid={`project-row-members-${p.id}`}>
                    {p.members.length} {p.members.length === 1 ? 'member' : 'members'}
                  </span>
                </RowButton>
              );
            })
          )}
        </div>
      </aside>

      {/* Detail */}
      <section className="flex flex-col bg-card border border-hairline rounded-[14px] overflow-hidden">
        {!selected ? (
          <EmptyState
            title="No project selected"
            description={projects.length === 0 ? 'Create your first project to get started.' : 'Pick a project from the list.'}
          />
        ) : (
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {editName ? (
                  <div className="flex items-center gap-2">
                    <Input
                      autoFocus
                      value={nameDraft}
                      onChange={e => setNameDraft(e.target.value)}
                    />
                    <IconButton
                      data-write
                      aria-label="Save name"
                      onClick={() =>
                        updateProject.mutate(
                          { id: selected.id, req: { name: nameDraft.trim(), systemEndpointId: selected.systemEndpointId } },
                          { onSuccess: finishEdit },
                        )
                      }
                      disabled={!nameDraft.trim() || nameDraft.trim() === selected.name}
                    >
                      <CheckIcon size={14} />
                    </IconButton>
                    <IconButton aria-label="Cancel" onClick={() => { setEditName(false); setNameDraft(selected.name); }}>
                      <XIcon size={14} />
                    </IconButton>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h2 className="text-[20px] font-bold m-0 text-primary truncate">{selected.name}</h2>
                    <IconButton data-write aria-label="Edit name" onClick={() => { setNameDraft(selected.name); setEditName(true); }}>
                      <EditIcon size={14} />
                    </IconButton>
                  </div>
                )}
                <div className="text-[12px] text-muted mt-1">
                  Created {fmtDate(selected.createdAt)} · Updated {fmtDate(selected.updatedAt)}
                </div>
              </div>
              <Button
                variant="dangerOutline"
                size="sm"
                data-testid="project-delete-btn"
                leftIcon={<TrashIcon size={14} />}
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </Button>
            </div>

            {/* System endpoint */}
            <div>
              <FormField label="System endpoint">
                {editEndpoint ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <Select
                        autoFocus
                        value={endpointDraft}
                        onValueChange={setEndpointDraft}
                      >
                        {endpoints.map(e => (
                          <option key={e.id} value={e.id}>
                            {e.providerName} · {e.modelName}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <IconButton
                      data-write
                      aria-label="Save endpoint"
                      onClick={() =>
                        updateProject.mutate(
                          { id: selected.id, req: { name: selected.name, systemEndpointId: endpointDraft } },
                          { onSuccess: finishEdit },
                        )
                      }
                      disabled={endpointDraft === selected.systemEndpointId}
                    >
                      <CheckIcon size={14} />
                    </IconButton>
                    <IconButton
                      aria-label="Cancel"
                      onClick={() => { setEditEndpoint(false); setEndpointDraft(selected.systemEndpointId); }}
                    >
                      <XIcon size={14} />
                    </IconButton>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-primary">
                      {endpointLabel(endpoints, selected.systemEndpointId)}
                    </span>
                    <IconButton data-write aria-label="Edit endpoint" onClick={() => { setEndpointDraft(selected.systemEndpointId); setEditEndpoint(true); }}>
                      <EditIcon size={14} />
                    </IconButton>
                  </div>
                )}
              </FormField>
            </div>

            {/* Members */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-bold m-0 text-primary">
                  Members <span className="text-muted font-normal">({selected.members.length})</span>
                </h3>
                <Button
                  variant="secondary"
                  size="sm"
                  data-write
                  data-testid="add-member-btn"
                  leftIcon={<PlusIcon size={12} />}
                  onClick={() => setShowAddMember(true)}
                >
                  Add member
                </Button>
              </div>
              {selected.members.length === 0 ? (
                <EmptyState
                  title="No members yet"
                  description="Add users to this project to grant them access."
                />
              ) : (
                <div className="border border-hairline rounded-[10px] overflow-hidden">
                  {selected.members.map(m => (
                    <div
                      key={m.id}
                      data-testid={`member-row-${m.id}`}
                      className="flex items-center gap-3 px-3 py-[10px] border-b border-hairline last:border-b-0"
                    >
                      <Avatar
                        initials={initials(m.email)}
                        color={colorFor(m.id)}
                        className="w-7 h-7 rounded-md text-[10px]"
                      />
                      <span className="flex-1 text-[13px] font-semibold text-primary">{m.email}</span>
                      <IconButton
                        data-write
                        aria-label={`Remove ${m.email}`}
                        className="text-muted hover:text-danger"
                        onClick={() => setRemoveMember(m)}
                      >
                        <TrashIcon size={14} />
                      </IconButton>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Modals */}
      {showNew && (
        <NewProjectModal
          endpoints={endpoints}
          onCancel={() => setShowNew(false)}
          onSubmit={(req) => createProject.mutate(req, { onSuccess: p => { setShowNew(false); setSelectedId(p.id); } })}
          loading={createProject.isPending}
        />
      )}
      {showAddMember && selected && (
        <AddMemberModal
          excludeIds={selected.members.map(m => m.id)}
          onCancel={() => setShowAddMember(false)}
          onPick={(userId) => addMember.mutate({ projectId: selected.id, userId }, { onSuccess: () => setShowAddMember(false) })}
          loading={addMember.isPending}
        />
      )}
      {removeMember && selected && (
        <ConfirmDialog
          entityName={removeMember.email}
          onCancel={() => setRemoveMember(null)}
          onConfirm={() => removeMemberMut.mutate({ projectId: selected.id, userId: removeMember.id }, { onSuccess: () => setRemoveMember(null) })}
          loading={removeMemberMut.isPending}
        />
      )}
      {confirmDelete && selected && (
        <ConfirmDialog
          entityName={selected.name}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => deleteProject.mutate(selected.id, { onSuccess: () => { setConfirmDelete(false); setSelectedId(null); } })}
          loading={deleteProject.isPending}
        />
      )}
    </div>
  );
}
