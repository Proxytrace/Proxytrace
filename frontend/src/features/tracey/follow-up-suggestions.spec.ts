import { describe, expect, it } from 'vitest';
import type { ThreadMessage } from '@assistant-ui/react';
import {
  FOLLOW_UP_COUNT,
  buildFollowUpPrompt,
  latestExchange,
  parseFollowUps,
} from './follow-up-suggestions';

describe('parseFollowUps', () => {
  it('parses a plain JSON array into trimmed suggestions', () => {
    expect(parseFollowUps('["Show the failing cases", " Compare with the last run "]')).toEqual([
      'Show the failing cases',
      'Compare with the last run',
    ]);
  });

  it('tolerates code fences and surrounding prose', () => {
    const raw = 'Here you go:\n```json\n["Run the suite again", "Plot token usage"]\n```';
    expect(parseFollowUps(raw)).toEqual(['Run the suite again', 'Plot token usage']);
  });

  it('caps the result at FOLLOW_UP_COUNT entries', () => {
    expect(parseFollowUps('["a", "b", "c", "d"]')).toHaveLength(FOLLOW_UP_COUNT);
  });

  it('drops non-strings, empties, overlong entries, and case-insensitive duplicates', () => {
    const long = 'x'.repeat(200);
    expect(parseFollowUps(`[42, "", "${long}", "Show it", "show it", "Next"]`)).toEqual([
      'Show it',
      'Next',
    ]);
  });

  it('returns [] for malformed or array-less replies', () => {
    expect(parseFollowUps('no array here')).toEqual([]);
    expect(parseFollowUps('[not json]')).toEqual([]);
    expect(parseFollowUps('{"a": 1}')).toEqual([]);
  });
});

describe('buildFollowUpPrompt', () => {
  it('includes both sides of the exchange', () => {
    const prompt = buildFollowUpPrompt('list my agents', 'You have 3 agents.');
    expect(prompt).toContain('list my agents');
    expect(prompt).toContain('You have 3 agents.');
  });

  it('truncates oversized inputs', () => {
    const prompt = buildFollowUpPrompt('u'.repeat(5000), 'a'.repeat(5000));
    expect(prompt.length).toBeLessThan(4000);
    expect(prompt).toContain('…');
  });
});

function userMessage(text: string): ThreadMessage {
  return {
    id: 'u1',
    role: 'user',
    createdAt: new Date(0),
    content: [{ type: 'text', text }],
    attachments: [],
    metadata: { custom: {} },
  } as unknown as ThreadMessage;
}

function assistantMessage(parts: Array<{ type: string; text?: string }>): ThreadMessage {
  return {
    id: 'a1',
    role: 'assistant',
    createdAt: new Date(0),
    content: parts,
    status: { type: 'complete', reason: 'stop' },
    metadata: { custom: {}, steps: [], unstable_state: null, unstable_annotations: [], unstable_data: [] },
  } as unknown as ThreadMessage;
}

describe('latestExchange', () => {
  it('pairs the last user text with the trailing assistant text', () => {
    const exchange = latestExchange([
      userMessage('list my agents'),
      assistantMessage([{ type: 'text', text: 'You have 3 agents.' }]),
    ]);
    expect(exchange).toEqual({ userText: 'list my agents', assistantText: 'You have 3 agents.' });
  });

  it('returns null when the thread does not end in an assistant message', () => {
    expect(latestExchange([userMessage('hi')])).toBeNull();
    expect(latestExchange([])).toBeNull();
  });

  it('returns null for a text-less assistant message (tool-only turn)', () => {
    const exchange = latestExchange([
      userMessage('go'),
      assistantMessage([{ type: 'tool-call', text: undefined }]),
    ]);
    expect(exchange).toBeNull();
  });
});
