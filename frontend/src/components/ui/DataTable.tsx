import { cn } from '../../lib/cn';
import { EYEBROW_CLS } from './classes';

export interface DataColumn<T> {
  key: string;
  label: React.ReactNode;
  width: string;
  render: (row: T, index: number) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: DataColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T, index: number) => void;
  isSelected?: (row: T) => boolean;
  emptyMessage?: string;
  emptySlot?: React.ReactNode;
  className?: string;
}

export function DataTable<T>({
  columns, rows, rowKey, onRowClick, isSelected, emptyMessage, emptySlot, className = '',
}: DataTableProps<T>) {
  const gridCols = columns.map(c => c.width).join(' ');
  const sharedRowClass = cn(`grid w-full text-left px-4 py-2.75 items-center text-body border-b border-hairline`);

  return (
    <div className={className}>
      {/* Header */}
      <div
        className={cn(EYEBROW_CLS, 'grid px-4 py-2.5 border-b border-hairline')}
        style={{ gridTemplateColumns: gridCols }}
      >
        {columns.map(c => <span key={c.key} className={`min-w-0 ${c.className ?? ''}`}>{c.label}</span>)}
      </div>

      {/* Empty state */}
      {rows.length === 0 && emptySlot}
      {rows.length === 0 && !emptySlot && emptyMessage && (
        <div className="text-center px-5 py-14 text-muted text-title">{emptyMessage}</div>
      )}

      {/* Rows */}
      {rows.map((row, index) => {
        const selected = isSelected?.(row) ?? false;
        const bg = selected ? 'color-mix(in srgb, var(--accent-primary) 6%, transparent)' : 'transparent';
        if (onRowClick) {
          return (
            <button
              key={rowKey(row)}
              type="button"
              onClick={() => onRowClick(row, index)}
              className={`${sharedRowClass} bg-transparent border-x-0 border-t-0 transition-[background] duration-[100ms] cursor-pointer`}
              style={{ gridTemplateColumns: gridCols, background: bg }}
              onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-primary) 4%, transparent)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = bg; }}
            >
              {columns.map(c => <span key={c.key} className={`min-w-0 ${c.className ?? ''}`}>{c.render(row, index)}</span>)}
            </button>
          );
        }
        return (
          <div
            key={rowKey(row)}
            className={sharedRowClass}
            style={{ gridTemplateColumns: gridCols, background: bg }}
          >
            {columns.map(c => <span key={c.key} className={`min-w-0 ${c.className ?? ''}`}>{c.render(row, index)}</span>)}
          </div>
        );
      })}
    </div>
  );
}
