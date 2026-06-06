import { describe, it, expect } from 'vitest';
import type { MessageDto, ToolArgumentDto, ToolSpecDto } from '../../../api/models';
import {
  argsValid,
  argsSkeleton,
  isArgsEmpty,
  expectedFromResponse,
  toMessage,
  validateExpected,
} from './expectedOutput';

function msg(partial: Partial<MessageDto>): MessageDto {
  return { role: 'assistant', content: '', toolRequests: [], toolCallId: null, ...partial };
}

function arg(partial: Partial<ToolArgumentDto> & { name: string }): ToolArgumentDto {
  return { description: null, type: 'string', isRequired: false, enumValues: null, ...partial };
}

function tool(name: string, args: ToolArgumentDto[]): ToolSpecDto {
  return { name, description: '', arguments: args };
}

describe('expectedFromResponse', () => {
  it('produces text mode for a plain response', () => {
    const v = expectedFromResponse(msg({ content: 'hello' }));
    expect(v).toEqual({ content: 'hello', toolRequests: null });
  });

  it('produces tool mode when the response has tool requests', () => {
    const v = expectedFromResponse(msg({
      content: 'ignored',
      toolRequests: [{ id: 'a', name: 'get_weather', arguments: '{"city":"Vienna"}' }],
    }));
    expect(v.toolRequests).toEqual([{ name: 'get_weather', arguments: '{"city":"Vienna"}' }]);
    expect(v.content).toBe('');
  });

  it('falls back to empty text for a null response', () => {
    expect(expectedFromResponse(null)).toEqual({ content: '', toolRequests: null });
  });
});

describe('validateExpected', () => {
  it('requires non-empty content in text mode', () => {
    expect(validateExpected({ content: '   ', toolRequests: null })).toBe(false);
    expect(validateExpected({ content: 'ok', toolRequests: null })).toBe(true);
  });

  it('requires at least one tool request in tool mode', () => {
    expect(validateExpected({ content: '', toolRequests: [] })).toBe(false);
  });

  it('rejects tool requests with empty names or invalid JSON args', () => {
    expect(validateExpected({ content: '', toolRequests: [{ name: '', arguments: '{}' }] })).toBe(false);
    expect(validateExpected({ content: '', toolRequests: [{ name: 'x', arguments: 'not json' }] })).toBe(false);
    expect(validateExpected({ content: '', toolRequests: [{ name: 'x', arguments: '{}' }] })).toBe(true);
  });
});

describe('argsValid', () => {
  it('rejects empty and malformed JSON, accepts valid JSON', () => {
    expect(argsValid('')).toBe(false);
    expect(argsValid('{')).toBe(false);
    expect(argsValid('{"a":1}')).toBe(true);
  });
});

describe('argsSkeleton', () => {
  it('infers placeholder values per declared type', () => {
    const t = tool('query', [
      arg({ name: 'metric', type: 'string' }),
      arg({ name: 'days', type: 'integer' }),
      arg({ name: 'verbose', type: 'boolean' }),
      arg({ name: 'tags', type: 'array' }),
      arg({ name: 'filter', type: 'object' }),
    ]);
    expect(JSON.parse(argsSkeleton(t))).toEqual({
      metric: '', days: 0, verbose: false, tags: [], filter: {},
    });
  });

  it('uses the first enum value when present', () => {
    const t = tool('scan', [arg({ name: 'sensitivity', type: 'string', enumValues: ['low', 'high'] })]);
    expect(JSON.parse(argsSkeleton(t))).toEqual({ sensitivity: 'low' });
  });

  it('produces pretty-printed JSON', () => {
    expect(argsSkeleton(tool('x', [arg({ name: 'a' })]))).toContain('\n');
  });
});

describe('isArgsEmpty', () => {
  it('treats blank and empty-object strings as empty', () => {
    expect(isArgsEmpty('')).toBe(true);
    expect(isArgsEmpty('   ')).toBe(true);
    expect(isArgsEmpty('{}')).toBe(true);
    expect(isArgsEmpty('{\n  \n}')).toBe(true);
  });

  it('treats populated JSON as non-empty', () => {
    expect(isArgsEmpty('{"a":1}')).toBe(false);
  });
});

describe('toMessage', () => {
  it('blanks content in tool mode and passes tool requests through', () => {
    const out = toMessage({ content: 'leftover', toolRequests: [{ name: 'x', arguments: '{}' }] });
    expect(out).toEqual({ role: 'assistant', content: '', toolRequests: [{ name: 'x', arguments: '{}' }] });
  });

  it('keeps content and null tool requests in text mode', () => {
    const out = toMessage({ content: 'answer', toolRequests: null });
    expect(out).toEqual({ role: 'assistant', content: 'answer', toolRequests: null });
  });
});
