import { DataTable, type DataColumn } from '../../../../components/ui/DataTable';
import type { TableArtifact as TableArtifactData } from '../../tracey-artifacts';

type Row = { __i: number; cells: (string | number)[] };

/** Renders a table artifact via the shared DataTable. */
export function TableArtifact({ artifact }: { artifact: TableArtifactData }) {
  const rows: Row[] = artifact.rows.map((cells, i) => ({ __i: i, cells }));
  const columns: DataColumn<Row>[] = artifact.columns.map((label, ci) => ({
    key: String(ci),
    label,
    width: 'minmax(0, 1fr)',
    render: row => <span className="truncate">{row.cells[ci]}</span>,
  }));

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={row => String(row.__i)}
        emptyMessage="No rows."
      />
    </div>
  );
}
