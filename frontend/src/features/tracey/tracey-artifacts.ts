/**
 * Shapes the `show_chart` / `show_table` / `show_text` tools return. Each is rendered
 * **inline in the chat thread** by the matching tool-UI component (see
 * `components/tool-ui/`). Nothing here is persisted server-side, and there is no longer a
 * side panel — a tool result is the artifact.
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
