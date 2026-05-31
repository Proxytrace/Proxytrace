/**
 * Frontend-only artifact model for the Tracey AI page. Tracey "produces an artifact" by calling
 * the `show_chart` / `show_table` / `show_text` tools (see {@link createTraceyTools}); the user can
 * also pin a read-tool result. Artifacts live in `useTraceyChat` state and render in the right
 * split panel. Nothing here is persisted server-side.
 */

export type ChartType = 'bar' | 'line' | 'area';

export interface ChartPoint {
  label: string;
  value: number;
}

export interface ChartArtifact {
  id: string;
  kind: 'chart';
  title: string;
  chartType: ChartType;
  points: ChartPoint[];
}

export interface TableArtifact {
  id: string;
  kind: 'table';
  title: string;
  columns: string[];
  rows: (string | number)[][];
}

export type TextFormat = 'markdown' | 'json' | 'code';

export interface TextArtifact {
  id: string;
  kind: 'text';
  title: string;
  format: TextFormat;
  content: string;
}

export type TraceyArtifact = ChartArtifact | TableArtifact | TextArtifact;

/** An artifact without its generated id — what producers (tools / pin) hand to `showArtifact`. */
export type TraceyArtifactInput =
  | Omit<ChartArtifact, 'id'>
  | Omit<TableArtifact, 'id'>
  | Omit<TextArtifact, 'id'>;

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `artifact-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function withId(input: TraceyArtifactInput): TraceyArtifact {
  return { ...input, id: newId() } as TraceyArtifact;
}

/**
 * Best-effort coercion of an arbitrary tool result into a pinnable artifact: a flat array of
 * objects becomes a table; everything else becomes a pretty-printed JSON text artifact.
 */
export function resultToArtifact(title: string, result: unknown): TraceyArtifactInput {
  if (Array.isArray(result) && result.length > 0 && result.every(isFlatRecord)) {
    const columns = Array.from(
      result.reduce<Set<string>>((acc, row) => {
        Object.keys(row).forEach(k => acc.add(k));
        return acc;
      }, new Set<string>()),
    );
    const rows = result.map(row =>
      columns.map(c => {
        const v = (row as Record<string, unknown>)[c];
        return v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : (v as string | number);
      }),
    );
    return { kind: 'table', title, columns, rows };
  }
  return {
    kind: 'text',
    title,
    format: 'json',
    content: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
  };
}

function isFlatRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every(v => v == null || typeof v !== 'object')
  );
}
