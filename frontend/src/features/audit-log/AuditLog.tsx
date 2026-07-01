import { useState } from 'react';
import { Trans, Plural, useLingui } from '@lingui/react/macro';
import { SearchIcon } from '../../components/icons';
import { Input } from '../../components/ui/Input';
import { FilterDropdown } from '../../components/ui/FilterDropdown';
import { Pagination } from '../../components/ui/Pagination';
import { useDebounce } from '../../hooks/useDebounce';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { AuditAction, type AuditLogEntryDto } from '../../api/models';
import { useAuditLogQuery, PAGE_SIZE, PAGE_SIZE_OPTIONS } from './hooks/useAuditLogQueries';
import { AuditLogTable } from './components/AuditLogTable';
import { AuditLogDetail } from './components/AuditLogDetail';
import { TimeRangePicker } from '../../components/ui/TimeRangePicker';
import { ALL_TIME, resolveRange, type TimeRange } from '../../lib/timeRange';
import useCurrentProject from '../../hooks/useCurrentProject';
import { AUDIT_ACTION_LABEL } from './auditLogMeta';

// eslint-disable-next-line lingui/no-unlocalized-strings -- filter sentinel, not UI copy
const ALL_ACTIONS = 'all';
type ActionFilter = typeof ALL_ACTIONS | AuditAction;

interface AuditLogProps {
  projectScoped?: boolean;
}

export default function AuditLog({ projectScoped }: AuditLogProps) {
  const { t, i18n } = useLingui();
  const { currentProjectId } = useCurrentProject();

  const [page, setPage] = useState(1);
  const [storedPageSize, setStoredPageSize] = useLocalStorageState<number>('auditLog.pageSize', PAGE_SIZE);
  const pageSize = (PAGE_SIZE_OPTIONS as readonly number[]).includes(storedPageSize) ? storedPageSize : PAGE_SIZE;
  const [actionFilter, setActionFilter] = useState<ActionFilter>(ALL_ACTIONS);
  const [actorSearch, setActorSearch] = useState('');
  const [timeRange, setTimeRange] = useState<TimeRange>(ALL_TIME);
  const [selected, setSelected] = useState<AuditLogEntryDto | null>(null);

  const debouncedActor = useDebounce(actorSearch, 200);
  const trimmedActor = debouncedActor.trim();

  // The project-scoped view must NEVER issue an unscoped request: without a projectId the backend
  // falls back to the workspace-wide / all-member-projects view, contradicting "events for this
  // project". Until a project resolves, keep the query disabled rather than over-fetching.
  const projectReady = !projectScoped || !!currentProjectId;

  const { entries, total, isFetching } = useAuditLogQuery({
    page,
    pageSize,
    ...(actionFilter !== ALL_ACTIONS ? { action: actionFilter } : {}),
    ...(trimmedActor.length >= 2 ? { actor: trimmedActor } : {}),
    ...(projectScoped && currentProjectId ? { projectId: currentProjectId } : {}),
    ...resolveRange(timeRange),
  }, projectReady);

  function handleActionChange(value: string) {
    setActionFilter(value as ActionFilter);
    setPage(1);
  }

  function handleActorChange(value: string) {
    setActorSearch(value);
    setPage(1);
  }

  function handleTimeRangeChange(range: TimeRange) {
    setTimeRange(range);
    setPage(1);
  }

  function handlePageSizeChange(value: number) {
    setStoredPageSize(value);
    setPage(1);
  }

  const actionOptions = [
    { key: ALL_ACTIONS, label: t`All actions` },
    ...Object.values(AuditAction).map(a => ({ key: a, label: i18n._(AUDIT_ACTION_LABEL[a]) })),
  ];

  return (
    <div className="w-full min-w-0 h-full min-h-0 flex flex-col gap-3.5">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-h1 font-semibold text-primary"><Trans>Audit Log</Trans></h1>
          <p className="text-body-sm text-muted mt-1">
            {projectScoped
              ? <Trans>Security and lifecycle events for this project.</Trans>
              : <Trans>All security and lifecycle events across the workspace.</Trans>
            }
          </p>
        </div>
        <FilterDropdown
          label={t`Action:`}
          value={actionFilter}
          active={actionFilter !== ALL_ACTIONS}
          options={actionOptions}
          onChange={handleActionChange}
          width={220}
        />
      </header>

      <div className="shrink-0 flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[220px] max-w-[460px]">
          <Input
            leftAddon={<SearchIcon size={13} />}
            value={actorSearch}
            onChange={e => handleActorChange(e.target.value)}
            placeholder={t`Search by actor email…`}
            aria-label={t`Search audit log by actor email`}
            data-testid="audit-log-actor-search"
          />
        </div>
        <TimeRangePicker value={timeRange} onChange={handleTimeRangeChange} testId="audit-log-time" />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <AuditLogTable
          entries={entries}
          selectedId={selected?.id ?? null}
          onSelect={setSelected}
          isFetching={isFetching}
        />
      </div>

      <footer data-testid="audit-log-pagination" className="flex items-center justify-between gap-3 shrink-0">
        <FilterDropdown
          label={t`Per page:`}
          value={String(pageSize)}
          active
          direction="up"
          options={PAGE_SIZE_OPTIONS.map(n => ({ key: String(n), label: String(n) }))}
          onChange={key => handlePageSizeChange(Number(key))}
          width={110}
        />
        <Pagination page={page} total={total} pageSize={pageSize} onChange={setPage} />
        <span className="text-body-sm text-muted whitespace-nowrap">
          {total.toLocaleString()} <Plural value={total} one="event" other="events" />
        </span>
      </footer>

      {selected && <AuditLogDetail entry={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
