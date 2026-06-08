import { Pill } from '../../../components/ui/Pill';
import { RowButton } from '../../../components/ui/RowButton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { fmtRelative } from '../../../lib/format';
import type { ApplicationErrorDto } from '../../../api/models';
import { LEVEL_COLOR } from '../errorLogMeta';

interface ErrorLogTableProps {
  errors: ApplicationErrorDto[];
  selectedId: string | null;
  onSelect: (error: ApplicationErrorDto) => void;
  isFetching: boolean;
}

export function ErrorLogTable({ errors, selectedId, onSelect, isFetching }: ErrorLogTableProps) {
  if (errors.length === 0) {
    return (
      <EmptyState
        title="No errors logged"
        description="Application errors and critical failures will appear here as they occur."
      />
    );
  }

  return (
    <div
      data-testid="error-log-table"
      className={`flex flex-col ${isFetching ? 'opacity-60 transition-opacity' : ''}`}
    >
      <div className="grid grid-cols-[90px_1fr_220px_120px] gap-3 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted border-b border-hairline">
        <span>Level</span>
        <span>Message</span>
        <span>Source</span>
        <span className="text-right">When</span>
      </div>
      {errors.map(error => (
        <RowButton
          key={error.id}
          data-testid={`error-log-row-${error.id}`}
          onClick={() => onSelect(error)}
          className={`grid grid-cols-[90px_1fr_220px_120px] gap-3 px-3 py-2.5 items-center border-b border-hairline transition-colors ${
            error.id === selectedId ? 'bg-accent-subtle' : 'hover:bg-card-2'
          }`}
        >
          <span>
            <Pill label={error.level} color={LEVEL_COLOR[error.level]} size="sm" />
          </span>
          <span className="min-w-0 truncate text-[13px] text-primary font-medium">{error.message}</span>
          <span className="min-w-0 truncate text-xs text-muted font-mono" title={error.category}>
            {error.exceptionType ?? error.category}
          </span>
          <span className="text-right text-xs text-muted whitespace-nowrap">{fmtRelative(error.createdAt)}</span>
        </RowButton>
      ))}
    </div>
  );
}
