import { useMemo, useState } from 'react';
import type { ProjectMemberDto } from '../../api/models';
import { ConfirmDialog } from '../../components/overlays/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { SkeletonList } from '../../components/ui/Skeleton';
import { Avatar } from '../../components/ui/Avatar';
import { FormField } from '../../components/ui/FormField';
import { PlusIcon, TrashIcon, EditIcon, CheckIcon, XIcon } from '../../components/icons';
import { fmtDate } from '../../lib/format';
import { NewProjectModal } from './NewProjectModal';
import { AddMemberModal } from './AddMemberModal';
import { formInputCls } from '../../components/ui/classes';
import { initials, colorFor, endpointLabel } from './projectsMeta';
import {
  useProjects, useModelEndpoints, useProject,
  useCreateProject, useUpdateProject, useDeleteProject, useAddMember, useRemoveMember,
} from './hooks/useProjects';

export function ProjectsTab() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [showNew, setShowNew] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [removeMember, setRemoveMember] = useState<ProjectMemberDto | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [editName, setEditName] = useState(false);
  const [editEndpoint, setEditEndpoint] = useState(false);

  const { data: projectsData, isLoading: projectsLoading } = useProjects();
  const { data: endpoints = [] } = useModelEndpoints();

  const projects = useMemo(() => projectsData?.items ?? [], [projectsData]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(p => p.name.toLowerCase().includes(q));
  }, [projects, search]);

  const fallbackId = filtered[0]?.id ?? null;
  const effectiveId = selectedId && projects.some(p => p.id === selectedId) ? selectedId : fallbackId;

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
    <div className="grid grid-cols-[320px_1fr] gap-3 flex-1 min-h-0">
      {/* List */}
      <aside className="flex flex-col bg-card border border-hairline rounded-[14px] overflow-hidden">
        <div className="p-3 border-b border-hairline shrink-0 flex flex-col gap-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search projects…"
            className={formInputCls}
          />
          <button
            onClick={() => setShowNew(true)}
            data-write
            className="flex items-center justify-center gap-1.5 px-3 py-[7px] rounded-lg text-[12.5px] font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer bg-[image:var(--grad-accent)] shadow-[var(--shadow-btn)]"
          >
            <PlusIcon size={14} />
            New project
          </button>
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
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={`flex flex-col items-start gap-0.5 w-full px-3 py-[10px] text-left bg-transparent border-none border-b border-hairline cursor-pointer ${
                    isActive ? 'bg-[color-mix(in_srgb,_var(--accent-primary)_6%,_transparent)]' : 'hover:bg-[color-mix(in_srgb,_var(--accent-primary)_4%,_transparent)]'
                  }`}
                >
                  <span className="text-[13px] font-semibold text-primary">{p.name}</span>
                  <span className="text-[11px] text-muted">
                    {p.members.length} {p.members.length === 1 ? 'member' : 'members'}
                  </span>
                </button>
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
                    <input
                      autoFocus
                      value={nameDraft}
                      onChange={e => setNameDraft(e.target.value)}
                      className={formInputCls}
                    />
                    <button
                      className="btn-icon"
                      data-write
                      onClick={() =>
                        updateProject.mutate(
                          { id: selected.id, req: { name: nameDraft.trim(), systemEndpointId: selected.systemEndpointId } },
                          { onSuccess: finishEdit },
                        )
                      }
                      disabled={!nameDraft.trim() || nameDraft.trim() === selected.name}
                    >
                      <CheckIcon size={14} />
                    </button>
                    <button className="btn-icon" onClick={() => { setEditName(false); setNameDraft(selected.name); }}>
                      <XIcon size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h2 className="text-[20px] font-bold m-0 text-primary truncate">{selected.name}</h2>
                    <button className="btn-icon" data-write onClick={() => { setNameDraft(selected.name); setEditName(true); }}>
                      <EditIcon size={14} />
                    </button>
                  </div>
                )}
                <div className="text-[12px] text-muted mt-1">
                  Created {fmtDate(selected.createdAt)} · Updated {fmtDate(selected.updatedAt)}
                </div>
              </div>
              <button
                onClick={() => setConfirmDelete(true)}
                data-write
                className="flex items-center gap-1.5 px-3 py-[7px] rounded-lg text-[12.5px] font-semibold cursor-pointer bg-transparent border border-[color-mix(in_srgb,var(--danger)_30%,transparent)] text-danger hover:bg-danger-subtle"
              >
                <TrashIcon size={14} />
                Delete
              </button>
            </div>

            {/* System endpoint */}
            <div>
              <FormField label="System endpoint">
                {editEndpoint ? (
                  <div className="flex items-center gap-2">
                    <select
                      autoFocus
                      value={endpointDraft}
                      onChange={e => setEndpointDraft(e.target.value)}
                      className={formInputCls}
                    >
                      {endpoints.map(e => (
                        <option key={e.id} value={e.id}>
                          {e.providerName} · {e.modelName}
                        </option>
                      ))}
                    </select>
                    <button
                      className="btn-icon"
                      data-write
                      onClick={() =>
                        updateProject.mutate(
                          { id: selected.id, req: { name: selected.name, systemEndpointId: endpointDraft } },
                          { onSuccess: finishEdit },
                        )
                      }
                      disabled={endpointDraft === selected.systemEndpointId}
                    >
                      <CheckIcon size={14} />
                    </button>
                    <button
                      className="btn-icon"
                      onClick={() => { setEditEndpoint(false); setEndpointDraft(selected.systemEndpointId); }}
                    >
                      <XIcon size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-primary">
                      {endpointLabel(endpoints, selected.systemEndpointId)}
                    </span>
                    <button className="btn-icon" data-write onClick={() => { setEndpointDraft(selected.systemEndpointId); setEditEndpoint(true); }}>
                      <EditIcon size={14} />
                    </button>
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
                <button
                  onClick={() => setShowAddMember(true)}
                  data-write
                  className="flex items-center gap-1.5 px-3 py-[6px] rounded-lg text-[12px] font-semibold cursor-pointer bg-card-2 border border-hairline text-primary hover:bg-[color-mix(in_srgb,_var(--accent-primary)_8%,_transparent)]"
                >
                  <PlusIcon size={12} />
                  Add member
                </button>
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
                      className="flex items-center gap-3 px-3 py-[10px] border-b border-hairline last:border-b-0"
                    >
                      <Avatar
                        initials={initials(m.email)}
                        color={colorFor(m.id)}
                        className="w-7 h-7 rounded-md text-[10px]"
                      />
                      <span className="flex-1 text-[13px] font-semibold text-primary">{m.email}</span>
                      <button
                        className="btn-icon text-muted hover:text-danger"
                        data-write
                        onClick={() => setRemoveMember(m)}
                        aria-label={`Remove ${m.email}`}
                      >
                        <TrashIcon size={14} />
                      </button>
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
