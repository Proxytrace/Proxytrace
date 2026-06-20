import { Plural, useLingui } from '@lingui/react/macro';
import { DataTable, type DataColumn } from '../../../../components/ui/DataTable';
import { cn } from '../../../../lib/cn';
import type { TableArtifact as TableArtifactData } from '../../tracey-artifacts';

type Row = { __i: number; cells: (string | number)[] };

/** A column is treated as numeric when every populated cell parses as a finite number. */
function isNumericColumn(rows: (string | number)[][], ci: number): boolean {
  let seen = false;
  for (const cells of rows) {
    const v = cells[ci];
    if (v === '' || v == null) continue;
    seen = true;
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) return false;
      continue;
    }
    if (Number.isNaN(Number(v))) return false;
  }
  return seen;
}

/**
 * Renders a table artifact via the shared DataTable. Numeric columns are right-aligned and set in
 * tabular mono so figures line up column-wise; a footer reports the row count.
 */
export function TableArtifact({ artifact }: { artifact: TableArtifactData }) {
  const { t } = useLingui();
  const rows: Row[] = artifact.rows.map((cells, i) => ({ __i: i, cells }));
  const numeric = artifact.columns.map((_, ci) => isNumericColumn(artifact.rows, ci));

  const columns: DataColumn<Row>[] = artifact.columns.map((label, ci) => {
    const num = numeric[ci];
    return {
      key: String(ci),
      label,
      width: num ? cn('minmax(72px, max-content)') : cn('minmax(0, 1fr)'),
      className: num ? 'text-right font-mono tabular-nums text-secondary' : '',
      render: (row) => <span className="block truncate">{row.cells[ci]}</span>,
    };
  });

  return (
    <div className="flex flex-col gap-1.5">
      <div className="overflow-x-auto rounded-lg border border-border">
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => String(row.__i)}
          emptyMessage={t`No rows.`}
        />
      </div>
      {rows.length > 0 && (
        <div className="px-1 text-body-sm text-muted">
          <Plural value={rows.length} one="# row" other="# rows" /> ·{' '}
          <Plural value={artifact.columns.length} one="# column" other="# columns" />
        </div>
      )}
    </div>
  );
}
