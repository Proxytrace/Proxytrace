import type { ThreadMessage } from '@assistant-ui/react';

/**
 * Follow-up suggestions: after each finished assistant turn a small extra LLM call proposes
 * {@link FOLLOW_UP_COUNT} messages the user might send next, rendered as clickable chips under the
 * conversation. This module is the pure half — prompt building and response parsing — so it stays
 * unit-testable; the call itself lives on `TraceyTransport.generateFollowUps` and the lifecycle in
 * `useFollowUpSuggestions`.
 */
export const FOLLOW_UP_COUNT = 2;

/** Keep the extra call cheap: the exchange is context, not something to reproduce. */
const MAX_USER_CHARS = 600;
const MAX_ASSISTANT_CHARS = 2400;
/** A suggestion is a chip — anything longer than this is a paragraph, not a follow-up. */
const MAX_SUGGESTION_CHARS = 160;

export const FOLLOW_UP_SYSTEM_PROMPT = [
  'You suggest follow-up messages for a user chatting with Tracey, the assistant of Proxytrace',
  '(an AI-agent observability and benchmarking platform). Given the latest exchange, propose',
  `exactly ${FOLLOW_UP_COUNT} short follow-up messages the user is likely to send next.`,
  'Write them in the user\'s voice (first person, addressed to the assistant), make them concrete',
  'and directly actionable from the exchange, and keep each under 12 words.',
  'Use the same language the user wrote in.',
  `Respond with ONLY a JSON array of ${FOLLOW_UP_COUNT} strings — no markdown, no commentary.`,
].join(' ');

/** The user-role prompt for the suggestion call: the latest exchange, truncated. */
export function buildFollowUpPrompt(userText: string, assistantText: string): string {
  const clip = (text: string, max: number): string =>
    text.length <= max ? text : `${text.slice(0, max)}…`;
  return [
    'User message:',
    clip(userText.trim(), MAX_USER_CHARS),
    '',
    'Assistant reply:',
    clip(assistantText.trim(), MAX_ASSISTANT_CHARS),
  ].join('\n');
}

/**
 * Parses the model's reply into at most {@link FOLLOW_UP_COUNT} clean suggestion strings.
 * Tolerates code fences and prose around the array; returns `[]` when nothing usable is found
 * (the UI simply shows no chips — never an error).
 */
export function parseFollowUps(raw: string): string[] {
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start === -1 || end <= start) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const seen = new Set<string>();
  const items: string[] = [];
  for (const entry of parsed) {
    if (typeof entry !== 'string') continue;
    const text = entry.trim();
    if (!text || text.length > MAX_SUGGESTION_CHARS) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(text);
    if (items.length === FOLLOW_UP_COUNT) break;
  }
  return items;
}

/** The joined text parts of a thread message ('' when it has none). */
function textOf(message: ThreadMessage): string {
  return message.content
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map(part => part.text)
    .join('\n')
    .trim();
}

export interface LatestExchange {
  userText: string;
  assistantText: string;
}

/**
 * The latest completed user→assistant exchange, or `null` when the thread doesn't end in an
 * assistant message with text (nothing to suggest follow-ups for — e.g. a tool-only answer).
 */
export function latestExchange(messages: readonly ThreadMessage[]): LatestExchange | null {
  const last = messages.at(-1);
  if (!last || last.role !== 'assistant') return null;
  const assistantText = textOf(last);
  if (!assistantText) return null;
  const lastUser = [...messages].reverse().find(m => m.role === 'user');
  return { userText: lastUser ? textOf(lastUser) : '', assistantText };
}
