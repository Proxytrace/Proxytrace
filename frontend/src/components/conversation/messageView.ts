/**
 * Pure logic for the message-bubble content view switcher: the available view modes, strict
 * JSON parsing for the JSON view, and the auto-detection that picks the initial mode from
 * content. HTML is never auto-selected — it is opt-in only (it renders sanitized markup).
 */

export type MessageView = 'raw' | 'json' | 'markdown' | 'html';

export const MESSAGE_VIEWS: readonly MessageView[] = ['raw', 'json', 'markdown', 'html'];

export const MESSAGE_VIEW_LABEL: Record<MessageView, string> = {
  raw: 'RAW',
  json: 'JSON',
  markdown: 'Markdown',
  html: 'HTML',
};

export type JsonParseResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string };

/**
 * Parses content as JSON, but only accepts objects/arrays as "JSON" — a bare scalar
 * (number, quoted string, boolean) is treated as not-JSON so a plain message doesn't
 * flip into JSON mode just because it happens to be a number.
 */
export function tryParseJson(content: string): JsonParseResult {
  const trimmed = content.trim();
  if (trimmed === '') return { ok: false, error: 'Empty content' };
  const first = trimmed[0];
  if (first !== '{' && first !== '[') {
    return { ok: false, error: 'Not a JSON object or array' };
  }
  try {
    return { ok: true, value: JSON.parse(trimmed) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Invalid JSON' };
  }
}

// Markdown signals: fenced code, ATX heading, list item, bold, inline link, or a GFM
// table delimiter row. Conservative on purpose — prose without any of these stays RAW.
const MARKDOWN_SIGNALS: readonly RegExp[] = [
  /```/, // fenced code block
  /^#{1,6}\s+\S/m, // # heading
  /^\s*[-*+]\s+\S/m, // - bullet list
  /^\s*\d+\.\s+\S/m, // 1. ordered list
  /\*\*[^\s].*?\*\*/, // **bold**
  /\[[^\]]+\]\([^)]+\)/, // [text](url)
  /^\s*\|.*\|\s*$/m, // | table row
];

/**
 * Picks the best initial view for content: a JSON object/array → 'json', content carrying
 * Markdown syntax → 'markdown', otherwise 'raw'.
 */
export function detectView(content: string): MessageView {
  if (tryParseJson(content).ok) return 'json';
  if (MARKDOWN_SIGNALS.some(re => re.test(content))) return 'markdown';
  return 'raw';
}
