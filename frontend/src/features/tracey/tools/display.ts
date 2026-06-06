import { z } from 'zod';
import { type ToolFactory, tool } from './shared';

export const createDisplayTools: ToolFactory = (_ctx, store) => ({
  show_chart: tool({
    description:
      'Render a chart inline in the chat to visualize data (e.g. token usage, pass rates over time). ' +
      'Prefer this over dumping numbers in chat. The chart is rendered to the user; you receive only ' +
      'a reference back, so you do not need to restate the data.',
    parameters: z.object({
      title: z.string().describe('Heading shown above the chart.'),
      type: z.enum(['bar', 'line', 'area']).describe('The chart style to render.'),
      points: z.array(z.object({
        label: z.string().describe('X-axis label for this data point.'),
        value: z.number().describe('Numeric value for this data point.'),
      })).describe('The data points to plot, in display order.'),
    }),
    confirm: false,
    execute: async ({ title, type, points }) =>
      store('chart', { kind: 'chart', title, chartType: type, points }, { kind: 'chart', title }),
  }),
  show_table: tool({
    description:
      'Render a table inline in the chat. Use for tabular comparisons. The table is rendered to the ' +
      'user; you receive only a reference back.',
    parameters: z.object({
      title: z.string().describe('Heading shown above the table.'),
      columns: z.array(z.string()).describe('Column header labels, left to right.'),
      rows: z.array(z.array(z.union([z.string(), z.number()])))
        .describe('Table rows; each row is an array of cells aligned to "columns".'),
    }),
    confirm: false,
    execute: async ({ title, columns, rows }) =>
      store('table', { kind: 'table', title, columns, rows }, { kind: 'table', title }),
  }),
  show_text: tool({
    description:
      'Render a longer text block (markdown, JSON, or code) inline in the chat as a titled card. ' +
      'The block is rendered to the user; you receive only a reference back.',
    parameters: z.object({
      title: z.string().describe('Heading shown above the text.'),
      format: z.enum(['markdown', 'json', 'code']).describe('How to render the content.'),
      content: z.string().describe('The full text body to render.'),
    }),
    confirm: false,
    execute: async ({ title, format, content }) =>
      store('text', { kind: 'text', title, format, content }, { kind: 'text', title }),
  }),
  ask_questions: tool({
    description:
      'Ask the user one or more clarifying questions before acting. Rendered inline as a ' +
      'stepped widget (one question at a time). Each question shows 2–4 options as a vertical ' +
      'list plus a static "Something else" free-text field. Set `multiple: true` to let the ' +
      'user pick several options for that question. Prefer this over asking in plain prose ' +
      '(disambiguation, gathering a few decisions, free-form input). You receive the user’s ' +
      'answers as this tool’s result (an `answers` array of `{ question, answer }`); continue ' +
      'once they arrive.',
    parameters: z.object({
      questions: z.array(z.object({
        id: z.string().describe('Machine key for this question, returned with its answer.'),
        question: z.string().describe('The question text shown to the user.'),
        multiple: z.boolean().optional().describe('Allow selecting more than one option.'),
        options: z.array(z.object({
          label: z.string().describe('Option label shown to the user.'),
          value: z.string().describe('Text recorded as the answer when this option is picked.'),
        })).min(2).max(4).describe('The 2–4 options offered, in display order.'),
      })).min(1).describe('Questions to ask in sequence, one at a time.'),
    }),
    confirm: false,
    // No execute: human-in-the-loop. The tool UI resolves it via addResult once the user answers.
  }),
});
