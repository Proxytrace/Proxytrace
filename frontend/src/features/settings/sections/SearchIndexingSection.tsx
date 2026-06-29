import { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { msg } from '@lingui/core/macro';
import type { MessageDescriptor } from '@lingui/core';
import { type SearchIndexingSettings, type SearchKind } from '../../../api/search';
import useCurrentProject from '../../../hooks/useCurrentProject';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Input } from '../../../components/ui/Input';
import { Skeleton, SkeletonList } from '../../../components/ui/Skeleton';
import { FormField } from '../../../components/ui/FormField';
import { ZapIcon, ClockIcon } from '../../../components/icons';
import { fmtRelative } from '../../../lib/format';
import { cn } from '../../../lib/cn';
import { useReindex, useSearchSettings, useSearchStatus, useUpdateSearchSettings } from '../hooks/useSearchIndexing';
import { StatusCell } from '../components/StatusCell';
import { ToggleRow } from '../components/ToggleRow';
import { SectionHeader } from '../components/SectionHeader';

const KIND_OPTIONS: { value: SearchKind; label: MessageDescriptor }[] = [
  { value: 'agent', label: msg`Agents` },
  { value: 'agentCall', label: msg`Agent calls` },
  { value: 'testSuite', label: msg`Test suites` },
  { value: 'testCase', label: msg`Test cases` },
  { value: 'evaluator', label: msg`Evaluators` },
];

/** Search indexing configuration for the active project. */
export function SearchIndexingSection() {
  const { t, i18n } = useLingui();
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
        title={t`No project selected`}
        description={t`Create a project in the Projects section to configure search indexing.`}
      />
    );
  }

  return (
    <div className="w-full min-w-0 flex flex-col" data-testid="settings-search">
      <SectionHeader title={t`Search indexing`} subtitle={t`Indexing configuration for the active project.`} />

      <div className="max-w-[760px] flex flex-col gap-5">
        {/* Status card */}
        <div className="bg-card-2 border border-hairline rounded-lg p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-h2 font-semibold m-0 text-primary"><Trans>Index status</Trans></h3>
            <Button
              variant="primary"
              size="sm"
              data-testid="reindex-btn"
              leftIcon={<ZapIcon size={14} />}
              loading={reindex.isPending || status?.isReindexing}
              disabled={reindex.isPending || status?.isReindexing}
              onClick={() => reindex.mutate(currentProjectId)}
            >
              <Trans>Reindex now</Trans>
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
              <StatusCell label={t`Documents`} value={status ? status.documentCount.toLocaleString() : '—'} />
              <StatusCell
                label={t`Last indexed`}
                value={status?.lastIndexedAt ? fmtRelative(status.lastIndexedAt) : t`Never`}
                icon={<ClockIcon size={12} />}
              />
              <StatusCell
                label={t`State`}
                value={status?.isReindexing ? t`Reindexing` : t`Idle`}
                valueClassName={status?.isReindexing ? cn('text-accent') : cn('text-success')}
                testId="index-status"
              />
            </div>
          )}
        </div>

        {/* Settings */}
        <div className="flex flex-col gap-4">
          <h3 className="text-h2 font-semibold m-0 text-primary"><Trans>Settings</Trans></h3>

          {settingsLoading && !draft ? (
            <SkeletonList rows={4} height={56} gap={8} />
          ) : settingsError ? (
            <div className="text-body text-danger"><Trans>Failed to load settings: {(settingsError as Error).message}</Trans></div>
          ) : draft ? (
            <>
              <ToggleRow
                label={t`Search enabled`}
                description={t`When disabled, search returns no results and indexing pauses.`}
                checked={draft.enabled}
                onChange={v => setDraft({ ...draft, enabled: v })}
                testId="toggle-row-enabled"
              />
              <ToggleRow
                label={t`Auto-reindex on change`}
                description={t`Update the index automatically when entities are created, updated, or deleted.`}
                checked={draft.autoReindexOnChange}
                onChange={v => setDraft({ ...draft, autoReindexOnChange: v })}
                testId="toggle-row-autoReindex"
              />

              <FormField label={t`Indexed entity kinds`}>
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
                        className={cn(
                          'px-3 py-1.5 rounded-full text-body font-semibold cursor-pointer border transition-colors',
                          checked
                            ? 'bg-[color-mix(in_srgb,_var(--accent-primary)_15%,_transparent)] border-[color-mix(in_srgb,_var(--accent-primary)_45%,_transparent)] text-primary'
                            : 'bg-card-2 border-hairline text-muted hover:text-primary',
                        )}
                      >
                        {i18n._(opt.label)}
                      </button>
                    );
                  })}
                </div>
              </FormField>

              <FormField label={t`Snippet length (characters)`}>
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
                  <Trans>Save changes</Trans>
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!dirty || updateSettings.isPending}
                  onClick={() => settings && setDraft(settings)}
                >
                  <Trans>Discard</Trans>
                </Button>
                {dirty && <span className="text-body text-muted ml-1"><Trans>Unsaved changes.</Trans></span>}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
