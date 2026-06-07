import { useState } from 'react';
import { type SearchIndexingSettings, type SearchKind } from '../../api/search';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import { RowButton } from '../../components/ui/RowButton';
import { Skeleton, SkeletonList } from '../../components/ui/Skeleton';
import { FormField } from '../../components/ui/FormField';
import { SearchIcon, ZapIcon, ClockIcon } from '../../components/icons';
import { fmtRelative } from '../../lib/format';
import { useReindex, useSearchSettings, useSearchStatus, useUpdateSearchSettings } from './hooks/useSearchIndexing';
import { useProjectSelection } from './hooks/useProjectSelection';
import { StatusCell } from './components/StatusCell';
import { ToggleRow } from './components/ToggleRow';

const KIND_OPTIONS: { value: SearchKind; label: string }[] = [
  { value: 'agent', label: 'Agents' },
  { value: 'agentCall', label: 'Agent calls' },
  { value: 'testSuite', label: 'Test suites' },
  { value: 'testCase', label: 'Test cases' },
  { value: 'evaluator', label: 'Evaluators' },
];

export function SearchIndexingTab() {
  const { setSelectedId, search, setSearch, projects, filtered, effectiveId, projectsLoading } =
    useProjectSelection();
  const selectedProject = projects.find(p => p.id === effectiveId);

  const { data: settings, isLoading: settingsLoading, error: settingsError } = useSearchSettings(effectiveId);

  // Seed the editable draft from server settings on initial load and whenever the selected project
  // changes — but NOT on every settings refetch, which would clobber an in-progress edit (a
  // background refetch returns a fresh object reference even when the data is unchanged). Keying on
  // the project id keeps the user's pending toggle intact across refetches.
  // Derive-on-change instead of an effect (BEST_PRACTICES §4.1).
  const [draft, setDraft] = useState<SearchIndexingSettings | null>(null);
  const [syncedProjectId, setSyncedProjectId] = useState<string | null>(null);
  // On project change, drop the previous project's draft (set the new project's settings if already
  // cached, otherwise null so the editor waits rather than showing stale values).
  if (effectiveId !== syncedProjectId) {
    setSyncedProjectId(effectiveId);
    setDraft(settings ?? null);
  }
  // Seed the draft once the current project's settings have loaded. After that, background refetches
  // (which return a fresh object reference) must NOT reseed, or they would clobber a pending edit.
  if (draft === null && settings && effectiveId === syncedProjectId) {
    setDraft(settings);
  }

  const { data: status, isLoading: statusLoading } = useSearchStatus(effectiveId);

  const updateSettings = useUpdateSearchSettings();
  const reindex = useReindex();

  const dirty = !draft || !settings
    ? false
    : (
      draft.enabled !== settings.enabled ||
      draft.autoReindexOnChange !== settings.autoReindexOnChange ||
      draft.snippetLength !== settings.snippetLength ||
      draft.indexedKinds.length !== settings.indexedKinds.length ||
      draft.indexedKinds.some(k => !settings.indexedKinds.includes(k))
    );

  function toggleKind(kind: SearchKind) {
    if (!draft) return;
    setDraft(
      draft.indexedKinds.includes(kind)
        ? { ...draft, indexedKinds: draft.indexedKinds.filter(k => k !== kind) }
        : { ...draft, indexedKinds: [...draft.indexedKinds, kind] }
    );
  }

  return (
    <div className="grid grid-cols-[320px_1fr] gap-3 flex-1 min-h-0" data-testid="search-indexing-tab">
      {/* Project list */}
      <aside className="flex flex-col bg-card border border-hairline rounded-[14px] overflow-hidden">
        <div className="p-3 border-b border-hairline shrink-0">
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects…" />
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
                  data-testid={`search-project-row-${p.id}`}
                  onClick={() => setSelectedId(p.id)}
                  className={`flex flex-col items-start gap-0.5 px-3 py-[10px] border-b border-hairline ${
                    isActive ? 'bg-[color-mix(in_srgb,_var(--accent-primary)_6%,_transparent)]' : 'hover:bg-[color-mix(in_srgb,_var(--accent-primary)_4%,_transparent)]'
                  }`}
                >
                  <span className="text-[13px] font-semibold text-primary">{p.name}</span>
                  <span className="text-[11px] text-muted">
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
                <Button
                  variant="primary"
                  size="sm"
                  data-testid="reindex-btn"
                  leftIcon={<ZapIcon size={14} />}
                  loading={reindex.isPending || status?.isReindexing}
                  disabled={reindex.isPending || status?.isReindexing}
                  onClick={() => reindex.mutate(selectedProject.id)}
                >
                  Reindex now
                </Button>
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
                    valueClassName={status?.isReindexing ? 'text-accent' : 'text-success'}
                    testId="index-status"
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
                <div className="text-[13px] text-danger">
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
                    testId="toggle-row-enabled"
                  />

                  {/* Auto-reindex */}
                  <ToggleRow
                    label="Auto-reindex on change"
                    description="Update the index automatically when entities are created, updated, or deleted."
                    checked={draft.autoReindexOnChange}
                    onChange={(v) => setDraft({ ...draft, autoReindexOnChange: v })}
                    testId="toggle-row-autoReindex"
                  />

                  {/* Indexed kinds */}
                  <FormField label="Indexed entity kinds">
                    <div className="flex flex-wrap gap-2">
                      {KIND_OPTIONS.map(opt => {
                        const checked = draft.indexedKinds.includes(opt.value);
                        return (
                          // eslint-disable-next-line no-restricted-syntax -- multi-select toggle pill; no Button variant fits this shape
                          <button
                            key={opt.value}
                            type="button"
                            aria-pressed={checked}
                            onClick={() => toggleKind(opt.value)}
                            className={`px-3 py-[6px] rounded-full text-[12px] font-semibold cursor-pointer border transition-colors ${
                              checked
                                ? 'bg-[color-mix(in_srgb,_var(--accent-primary)_15%,_transparent)] border-[color-mix(in_srgb,_var(--accent-primary)_45%,_transparent)] text-primary'
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
                    <Input
                      type="number"
                      min={20}
                      max={1000}
                      value={draft.snippetLength}
                      onChange={(e) => setDraft({ ...draft, snippetLength: Number(e.target.value) || 0 })}
                      className="max-w-[200px]"
                    />
                  </FormField>

                  {/* Save bar */}
                  <div className="flex items-center gap-2 pt-2 border-t border-hairline">
                    <Button
                      variant="primary"
                      size="sm"
                      data-testid="search-settings-save-btn"
                      loading={updateSettings.isPending}
                      disabled={!dirty || updateSettings.isPending}
                      onClick={() => updateSettings.mutate({ projectId: selectedProject.id, next: draft })}
                    >
                      Save changes
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!dirty || updateSettings.isPending}
                      onClick={() => settings && setDraft(settings)}
                    >
                      Discard
                    </Button>
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
