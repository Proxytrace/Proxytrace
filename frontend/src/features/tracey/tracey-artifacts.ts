/**
 * Shapes the `show_chart` / `show_table` / `show_text` tools build. Each is stashed in the browser
 * artifact store (see `tracey-artifact-store.ts`) and rendered **inline in the chat thread** by the
 * matching tool-UI component (see `components/tool-ui/`), which resolves it from a reference. The
 * model only ever sees the reference + a title-only digest, never the full payload. Nothing here is
 * persisted server-side, and there is no side panel.
 */

export type ChartType = 'bar' | 'line' | 'area';

export interface ChartPoint {
  label: string;
  value: number;
}

export interface ChartArtifact {
  kind: 'chart';
  title: string;
  chartType: ChartType;
  points: ChartPoint[];
}

export interface TableArtifact {
  kind: 'table';
  title: string;
  columns: string[];
  rows: (string | number)[][];
}

export type TextFormat = 'markdown' | 'json' | 'code';

export interface TextArtifact {
  kind: 'text';
  title: string;
  format: TextFormat;
  content: string;
}

export type TraceyArtifact = ChartArtifact | TableArtifact | TextArtifact;
