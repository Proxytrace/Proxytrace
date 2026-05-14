import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../../api/projects';
import { providersApi } from '../../api/providers';
import { QUERY_KEYS } from '../../api/query-keys';
import type { ProjectDto, ProjectMemberDto } from '../../api/models';
import { LIST_PAGE_SIZE } from '../../lib/constants';
import { useToast } from '../../components/ui/Toast';
import { ConfirmDialog } from '../../components/overlays/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { Avatar } from '../../components/ui/Avatar';
import { FormField, formInputCls } from '../../components/ui/FormField';
import { PlusIcon, TrashIcon, EditIcon, CheckIcon, XIcon } from '../../components/icons';
import { fmtDate } from '../../lib/format';
import { NewProjectModal } from './NewProjectModal';
import { AddMemberModal } from './AddMemberModal';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function colorFor(id: string): string {
  const palette = ['#c9944a', '#3daa6f', '#6b9eaa', '#5b82b0', '#d4915c', '#a07db8'];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

export function ProjectsTab() {
  const qc = useQueryClient();
  const { show: toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [showNew, setShowNew] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [removeMember, setRemoveMember] = useState<ProjectMemberDto | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [editName, setEditName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [editEndpoint, setEditEndpoint] = useState(false);
  const [endpointDraft, setEndpointDraft] = useState('');

  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: QUERY_KEYS.projects,
    queryFn: () => projectsApi.list({ pageSize: LIST_PAGE_SIZE }),
  });
  const { data: endpoints = [] } = useQuery({
    queryKey: QUERY_KEYS.modelEndpoints,
    queryFn: providersApi.getAllModels,
  });

  const projects = projectsData?.items ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(p => p.name.toLowerCase().includes(q));
  }, [projects, search]);

  const fallbackId = filtered[0]?.id ?? null;
  const effectiveId = selectedId && projects.some(p => p.id === selectedId) ? selectedId : fallbackId;

  const { data: selected } = useQuery({
    queryKey: QUERY_KEYS.project(effectiveId ?? 'none'),
    queryFn: () => projectsApi.get(effectiveId!),
    enabled: !!effectiveId,
  });

  useEffect(() => {
    if (selected) {
      setNameDraft(selected.name);
      setEndpointDraft(selected.systemEndpointId);
    }
  }, [selected?.id]);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: QUERY_KEYS.projects });
    if (effectiveId) qc.invalidateQueries({ queryKey: QUERY_KEYS.project(effectiveId) });
  };

  const createProject = useMutation({
    mutationFn: (req: { name: string; systemEndpointId: string }) => projectsApi.create(req),
    onSuccess: (p: ProjectDto) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.projects });
      setShowNew(false);
      setSelectedId(p.id);
    },
    onError: (err) => toast((err as Error).message || 'Failed to create project', 'error'),
  });

  const updateProject = useMutation({
    mutationFn: (req: { name: string; systemEndpointId: string }) =>
      projectsApi.update(selected!.id, req),
    onSuccess: () => {
      invalidateAll();
      setEditName(false);
      setEditEndpoint(false);
    },
    onError: (err) => toast((err as Error).message || 'Failed to update project', 'error'),
  });

  const deleteProject = useMutation({
    mutationFn: () => projectsApi.delete(selected!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.projects });
      setConfirmDelete(false);
      setSelectedId(null);
    },
    onError: (err) => toast((err as Error).message || 'Failed to delete project', 'error'),
  });

  const addMember = useMutation({
    mutationFn: (userId: string) => projectsApi.addMember(selected!.id, userId),
    onSuccess: () => {
      invalidateAll();
      setShowAddMember(false);
    },
    onError: (err) => toast((err as Error).message || 'Failed to add member', 'error'),
  });

  const removeMemberMut = useMutation({
    mutationFn: (userId: string) => projectsApi.removeMember(selected!.id, userId),
    onSuccess: () => {
      invalidateAll();
      setRemoveMember(null);
    },
    onError: (err) => toast((err as Error).message || 'Failed to remove member', 'error'),
  });

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
            className="flex items-center justify-center gap-1.5 px-3 py-[7px] rounded-lg text-[12.5px] font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer bg-[linear-gradient(135deg,#c9944a,#a57038)] shadow-[0_4px_14px_-4px_rgba(201,148,74,0.45),inset_0_1px_0_rgba(255,255,255,0.15)]"
          >
            <PlusIcon size={14} />
            New project
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {projectsLoading ? (
            <div className="p-6 text-[13px] text-muted text-center">Loading…</div>
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
                    isActive ? 'bg-[rgba(201,148,74,0.06)]' : 'hover:bg-[rgba(201,148,74,0.04)]'
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
                        updateProject.mutate({ name: nameDraft.trim(), systemEndpointId: selected.systemEndpointId })
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
                    <button className="btn-icon" data-write onClick={() => setEditName(true)}>
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
                className="flex items-center gap-1.5 px-3 py-[7px] rounded-lg text-[12.5px] font-semibold cursor-pointer bg-transparent border border-[rgba(217,85,85,0.3)] text-[#d95555] hover:bg-[rgba(217,85,85,0.08)]"
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
                        updateProject.mutate({ name: selected.name, systemEndpointId: endpointDraft })
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
                      {endpoints.find(e => e.id === selected.systemEndpointId)
                        ? `${endpoints.find(e => e.id === selected.systemEndpointId)!.providerName} · ${endpoints.find(e => e.id === selected.systemEndpointId)!.modelName}`
                        : selected.systemEndpointId}
                    </span>
                    <button className="btn-icon" data-write onClick={() => setEditEndpoint(true)}>
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
                  className="flex items-center gap-1.5 px-3 py-[6px] rounded-lg text-[12px] font-semibold cursor-pointer bg-card-2 border border-hairline text-primary hover:bg-[rgba(201,148,74,0.08)]"
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
                        className="btn-icon text-muted hover:text-[#d95555]"
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
          onSubmit={(req) => createProject.mutate(req)}
          loading={createProject.isPending}
        />
      )}
      {showAddMember && selected && (
        <AddMemberModal
          excludeIds={selected.members.map(m => m.id)}
          onCancel={() => setShowAddMember(false)}
          onPick={(userId) => addMember.mutate(userId)}
          loading={addMember.isPending}
        />
      )}
      {removeMember && (
        <ConfirmDialog
          entityName={removeMember.email}
          onCancel={() => setRemoveMember(null)}
          onConfirm={() => removeMemberMut.mutate(removeMember.id)}
          loading={removeMemberMut.isPending}
        />
      )}
      {confirmDelete && selected && (
        <ConfirmDialog
          entityName={selected.name}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => deleteProject.mutate()}
          loading={deleteProject.isPending}
        />
      )}
    </div>
  );
}
