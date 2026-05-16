import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../../api/projects';
import { searchApi, type SearchIndexingSettings, type SearchKind } from '../../api/search';
import { QUERY_KEYS } from '../../api/query-keys';
import { LIST_PAGE_SIZE } from '../../lib/constants';
import { useToast } from '../../components/ui/Toast';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton, SkeletonList } from '../../components/ui/Skeleton';
import { FormField, formInputCls } from '../../components/ui/FormField';
import { SearchIcon, ZapIcon, ClockIcon } from '../../components/icons';
import { fmtRelative } from '../../lib/format';

const KIND_OPTIONS: { value: SearchKind; label: string }[] = [
  { value: 'agent', label: 'Agents' },
  { value: 'agentCall', label: 'Agent calls' },
  { value: 'testSuite', label: 'Test suites' },
  { value: 'testCase', label: 'Test cases' },
  { value: 'evaluator', label: 'Evaluators' },
];

export function SearchIndexingTab() {
  const qc = useQueryClient();
  const { show: toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<SearchIndexingSettings | null>(null);

  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: QUERY_KEYS.projects,
    queryFn: () => projectsApi.list({ pageSize: LIST_PAGE_SIZE }),
  });
  const projects = projectsData?.items ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(p => p.name.toLowerCase().includes(q));
  }, [projects, search]);

  const fallbackId = filtered[0]?.id ?? null;
  const effectiveId = selectedId && projects.some(p => p.id === selectedId) ? selectedId : fallbackId;
  const selectedProject = projects.find(p => p.id === effectiveId);

  const { data: settings, isLoading: settingsLoading, error: settingsError } = useQuery({
    queryKey: QUERY_KEYS.searchSettings(effectiveId ?? 'none'),
    queryFn: () => searchApi.getSettings(effectiveId!),
    enabled: !!effectiveId,
    retry: false,
  });

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: QUERY_KEYS.searchStatus(effectiveId ?? 'none'),
    queryFn: () => searchApi.getStatus(effectiveId!),
    enabled: !!effectiveId,
    refetchInterval: 5000,
    retry: false,
  });

  useEffect(() => {
    if (settings) setDraft(settings);
  }, [settings]);

  const updateSettings = useMutation({
    mutationFn: (next: SearchIndexingSettings) => searchApi.updateSettings(effectiveId!, next),
    onSuccess: (saved) => {
      qc.setQueryData(QUERY_KEYS.searchSettings(effectiveId!), saved);
      toast('Search settings saved', 'success');
    },
  });

  const reindex = useMutation({
    mutationFn: () => searchApi.reindex(effectiveId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.searchStatus(effectiveId!) });
      toast('Reindex started', 'success');
    },
  });

  const dirty = useMemo(() => {
    if (!draft || !settings) return false;
    return (
      draft.enabled !== settings.enabled ||
      draft.autoReindexOnChange !== settings.autoReindexOnChange ||
      draft.snippetLength !== settings.snippetLength ||
      draft.indexedKinds.length !== settings.indexedKinds.length ||
      draft.indexedKinds.some(k => !settings.indexedKinds.includes(k))
    );
  }, [draft, settings]);

  function toggleKind(kind: SearchKind) {
    if (!draft) return;
    setDraft(
      draft.indexedKinds.includes(kind)
        ? { ...draft, indexedKinds: draft.indexedKinds.filter(k => k !== kind) }
        : { ...draft, indexedKinds: [...draft.indexedKinds, kind] }
    );
  }

  return (
    <div className="grid grid-cols-[320px_1fr] gap-3 flex-1 min-h-0">
      {/* Project list */}
      <aside className="flex flex-col bg-card border border-hairline rounded-[14px] overflow-hidden">
        <div className="p-3 border-b border-hairline shrink-0">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search projects…"
            className={formInputCls}
          />
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
        {!selectedProject ? (
          <EmptyState
            title="No project selected"
            description={projects.length === 0 ? 'Create a project first.' : 'Pick a project from the list.'}
          />
        ) : (
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <SearchIcon size={18} />
                  <h2 className="text-[20px] font-bold m-0 text-primary truncate">
                    {selectedProject.name}
                  </h2>
                </div>
                <div className="text-[12px] text-muted mt-1">
                  Search indexing configuration for this project.
                </div>
              </div>
            </div>

            {/* Status card */}
            <div className="bg-card-2 border border-hairline rounded-[12px] p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-bold m-0 text-primary">Index status</h3>
                <button
                  onClick={() => reindex.mutate()}
                  data-write
                  disabled={reindex.isPending || status?.isReindexing}
                  className="flex items-center gap-1.5 px-3 py-[7px] rounded-lg text-[12.5px] font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer bg-[linear-gradient(135deg,#c9944a,#a57038)] shadow-[0_4px_14px_-4px_rgba(201,148,74,0.45),inset_0_1px_0_rgba(255,255,255,0.15)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ZapIcon size={14} />
                  {status?.isReindexing || reindex.isPending ? 'Reindexing…' : 'Reindex now'}
                </button>
              </div>

              {statusLoading && !status ? (
                <div className="grid grid-cols-3 gap-3">
                  <Skeleton height={48} className="rounded-md" />
                  <Skeleton height={48} className="rounded-md" />
                  <Skeleton height={48} className="rounded-md" />
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  <StatusCell
                    label="Documents"
                    value={status ? status.documentCount.toLocaleString() : '—'}
                  />
                  <StatusCell
                    label="Last indexed"
                    value={status?.lastIndexedAt ? fmtRelative(status.lastIndexedAt) : 'Never'}
                    icon={<ClockIcon size={12} />}
                  />
                  <StatusCell
                    label="State"
                    value={status?.isReindexing ? 'Reindexing' : 'Idle'}
                    valueClassName={status?.isReindexing ? 'text-[#c9944a]' : 'text-[#3daa6f]'}
                  />
                </div>
              )}
            </div>

            {/* Settings */}
            <div className="flex flex-col gap-4">
              <h3 className="text-[14px] font-bold m-0 text-primary">Settings</h3>

              {settingsLoading && !draft ? (
                <SkeletonList rows={4} height={56} gap={8} />
              ) : settingsError ? (
                <div className="text-[13px] text-[#d95555]">
                  Failed to load settings: {(settingsError as Error).message}
                </div>
              ) : draft ? (
                <>
                  {/* Enabled toggle */}
                  <ToggleRow
                    label="Search enabled"
                    description="When disabled, search returns no results and indexing pauses."
                    checked={draft.enabled}
                    onChange={(v) => setDraft({ ...draft, enabled: v })}
                  />

                  {/* Auto-reindex */}
                  <ToggleRow
                    label="Auto-reindex on change"
                    description="Update the index automatically when entities are created, updated, or deleted."
                    checked={draft.autoReindexOnChange}
                    onChange={(v) => setDraft({ ...draft, autoReindexOnChange: v })}
                  />

                  {/* Indexed kinds */}
                  <FormField label="Indexed entity kinds">
                    <div className="flex flex-wrap gap-2">
                      {KIND_OPTIONS.map(opt => {
                        const checked = draft.indexedKinds.includes(opt.value);
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => toggleKind(opt.value)}
                            className={`px-3 py-[6px] rounded-full text-[12px] font-semibold cursor-pointer border transition-colors ${
                              checked
                                ? 'bg-[rgba(201,148,74,0.15)] border-[rgba(201,148,74,0.45)] text-primary'
                                : 'bg-card-2 border-hairline text-muted hover:text-primary'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </FormField>

                  {/* Snippet length */}
                  <FormField label="Snippet length (characters)">
                    <input
                      type="number"
                      min={20}
                      max={1000}
                      value={draft.snippetLength}
                      onChange={(e) =>
                        setDraft({ ...draft, snippetLength: Number(e.target.value) || 0 })
                      }
                      className={`${formInputCls} max-w-[200px]`}
                    />
                  </FormField>

                  {/* Save bar */}
                  <div className="flex items-center gap-2 pt-2 border-t border-hairline">
                    <button
                      onClick={() => updateSettings.mutate(draft)}
                      data-write
                      disabled={!dirty || updateSettings.isPending}
                      className="flex items-center gap-1.5 px-4 py-[7px] rounded-lg text-[12.5px] font-semibold text-white cursor-pointer bg-[linear-gradient(135deg,#c9944a,#a57038)] shadow-[0_4px_14px_-4px_rgba(201,148,74,0.45),inset_0_1px_0_rgba(255,255,255,0.15)] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {updateSettings.isPending ? 'Saving…' : 'Save changes'}
                    </button>
                    <button
                      onClick={() => settings && setDraft(settings)}
                      disabled={!dirty || updateSettings.isPending}
                      className="px-4 py-[7px] rounded-lg text-[12.5px] font-semibold cursor-pointer bg-transparent border border-hairline text-secondary hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Discard
                    </button>
                    {dirty && (
                      <span className="text-[12px] text-muted ml-1">Unsaved changes.</span>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function StatusCell({
  label,
  value,
  icon,
  valueClassName,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wide text-muted font-semibold">{label}</span>
      <span className={`text-[14px] font-semibold text-primary flex items-center gap-1 ${valueClassName ?? ''}`}>
        {icon}
        {value}
      </span>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4 cursor-pointer">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[13px] font-semibold text-primary">{label}</span>
        <span className="text-[12px] text-muted">{description}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 w-10 h-6 rounded-full transition-colors cursor-pointer ${
          checked ? 'bg-[linear-gradient(135deg,#c9944a,#a57038)]' : 'bg-card-2 border border-hairline'
        }`}
      >
        <span
          className={`absolute top-[2px] left-[2px] w-[18px] h-[18px] rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </label>
  );
}
