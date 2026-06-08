import { useState } from 'react';
import { SegmentedControl, type Segment } from '../../components/ui/SegmentedControl';
import { Pagination } from '../../components/ui/Pagination';
import { DEFAULT_PAGE_SIZE } from '../../lib/constants';
import { ApplicationErrorLevel, type ApplicationErrorDto } from '../../api/models';
import { useErrorLogQuery } from './hooks/useErrorLogQueries';
import { ErrorLogTable } from './components/ErrorLogTable';
import { ErrorLogDetail } from './components/ErrorLogDetail';

type LevelFilter = 'all' | ApplicationErrorLevel;

const LEVEL_SEGMENTS: Segment<LevelFilter>[] = [
  { value: 'all', label: 'All' },
  { value: ApplicationErrorLevel.Error, label: 'Error' },
  { value: ApplicationErrorLevel.Critical, label: 'Critical' },
];

export default function ErrorLog() {
  const [page, setPage] = useState(1);
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [selected, setSelected] = useState<ApplicationErrorDto | null>(null);

  const { errors, total, isFetching } = useErrorLogQuery({
    page,
    pageSize: DEFAULT_PAGE_SIZE,
    ...(levelFilter !== 'all' ? { level: levelFilter } : {}),
  });

  function handleLevelChange(value: LevelFilter) {
    setLevelFilter(value);
    setPage(1);
  }

  return (
    <div className="w-full min-w-0 h-full min-h-0 flex flex-col gap-[14px]">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold text-primary">Error Log</h1>
          <p className="text-[13px] text-muted mt-0.5">
            Latest application errors and critical failures captured across the backend.
          </p>
        </div>
        <SegmentedControl value={levelFilter} onChange={handleLevelChange} segments={LEVEL_SEGMENTS} />
      </header>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <ErrorLogTable
          errors={errors}
          selectedId={selected?.id ?? null}
          onSelect={setSelected}
          isFetching={isFetching}
        />
      </div>

      <footer className="flex items-center justify-between">
        <span className="text-xs text-muted">{total} {total === 1 ? 'error' : 'errors'}</span>
        <Pagination page={page} total={total} pageSize={DEFAULT_PAGE_SIZE} onChange={setPage} />
      </footer>

      {selected && <ErrorLogDetail error={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
