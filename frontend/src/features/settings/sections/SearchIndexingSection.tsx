import { useState } from 'react';
import { type SearchIndexingSettings, type SearchKind } from '../../../api/search';
import useCurrentProject from '../../../hooks/useCurrentProject';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Input } from '../../../components/ui/Input';
import { Skeleton, SkeletonList } from '../../../components/ui/Skeleton';
import { FormField } from '../../../components/ui/FormField';
import { ZapIcon, ClockIcon } from '../../../components/icons';
import { fmtRelative } from '../../../lib/format';
import { useReindex, useSearchSettings, useSearchStatus, useUpdateSearchSettings } from '../hooks/useSearchIndexing';
import { StatusCell } from '../components/StatusCell';
import { ToggleRow } from '../components/ToggleRow';
import { SectionHeader } from '../components/SectionHeader';

const KIND_OPTIONS: { value: SearchKind; label: string }[] = [
  { value: 'agent', label: 'Agents' },
  { value: 'agentCall', label: 'Agent calls' },
  { value: 'testSuite', label: 'Test suites' },
  { value: 'testCase', label: 'Test cases' },
  { value: 'evaluator', label: 'Evaluators' },
];

/** Search indexing configuration for the active project. */
export function SearchIndexingSection() {
  const { currentProjectId } = useCurrentProject();

  const { data: settings, isLoading: settingsLoading, error: settingsError } = useSearchSettings(currentProjectId);
  const { data: status, isLoading: statusLoading } = useSearchStatus(currentProjectId);

  const updateSettings = useUpdateSearchSettings();
  const reindex = useReindex();

  // Seed the editable draft from server settings on first load and whenever the active project
  // changes — but NOT on every background refetch (which returns a fresh object reference even when
  // unchanged) or it would clobber an in-progress edit. Derive-on-change, not an effect
  // (BEST_PRACTICES §4.1). The section stays mounted while the sidebar switches projects, so it
  // must re-seed on currentProjectId change — which this does.
  const [draft, setDraft] = useState<SearchIndexingSettings | null>(null);
  const [syncedProjectId, setSyncedProjectId] = useState<string | null>(null);
  if (currentProjectId !== syncedProjectId) {
    setSyncedProjectId(currentProjectId);
    setDraft(settings ?? null);
  }
  if (draft === null && settings && currentProjectId === syncedProjectId) {
    setDraft(settings);
  }

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
        : { ...draft, indexedKinds: [...draft.indexedKinds, kind] },
    );
  }

  if (!currentProjectId) {
    return (
      <EmptyState
        title="No project selected"
        description="Create a project in the Projects section to configure search indexing."
      />
    );
  }

  return (
    <div className="w-full min-w-0 flex flex-col" data-testid="settings-search">
      <SectionHeader title="Search indexing" subtitle="Indexing configuration for the active project." />

      <div className="max-w-[760px] flex flex-col gap-5">
        {/* Status card */}
        <div className="bg-card-2 border border-hairline rounded-[12px] p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-h2 font-semibold m-0 text-primary">Index status</h3>
            <Button
              variant="primary"
              size="sm"
              data-testid="reindex-btn"
              leftIcon={<ZapIcon size={14} />}
              loading={reindex.isPending || status?.isReindexing}
              disabled={reindex.isPending || status?.isReindexing}
              onClick={() => reindex.mutate(currentProjectId)}
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
              <StatusCell label="Documents" value={status ? status.documentCount.toLocaleString() : '—'} />
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
          <h3 className="text-h2 font-semibold m-0 text-primary">Settings</h3>

          {settingsLoading && !draft ? (
            <SkeletonList rows={4} height={56} gap={8} />
          ) : settingsError ? (
            <div className="text-body text-danger">Failed to load settings: {(settingsError as Error).message}</div>
          ) : draft ? (
            <>
              <ToggleRow
                label="Search enabled"
                description="When disabled, search returns no results and indexing pauses."
                checked={draft.enabled}
                onChange={v => setDraft({ ...draft, enabled: v })}
                testId="toggle-row-enabled"
              />
              <ToggleRow
                label="Auto-reindex on change"
                description="Update the index automatically when entities are created, updated, or deleted."
                checked={draft.autoReindexOnChange}
                onChange={v => setDraft({ ...draft, autoReindexOnChange: v })}
                testId="toggle-row-autoReindex"
              />

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

              <FormField label="Snippet length (characters)">
                <Input
                  type="number"
                  min={20}
                  max={1000}
                  value={draft.snippetLength}
                  onChange={e => setDraft({ ...draft, snippetLength: Number(e.target.value) || 0 })}
                  className="max-w-[200px]"
                />
              </FormField>

              <div className="flex items-center gap-2 pt-2 border-t border-hairline">
                <Button
                  variant="primary"
                  size="sm"
                  data-testid="search-settings-save-btn"
                  loading={updateSettings.isPending}
                  disabled={!dirty || updateSettings.isPending}
                  onClick={() => updateSettings.mutate({ projectId: currentProjectId, next: draft })}
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
                {dirty && <span className="text-body text-muted ml-1">Unsaved changes.</span>}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
