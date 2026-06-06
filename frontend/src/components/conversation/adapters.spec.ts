import { describe, it, expect } from 'vitest';
import { fromAgentCall, fromTestCase, fromFixtureInput, fromSimple } from './adapters';
import type { AgentCallDto, MessageDto, TestCaseDto } from '../../api/models';

function msg(partial: Partial<MessageDto>): MessageDto {
  return { role: 'user', content: '', toolRequests: [], toolCallId: null, ...partial };
}

describe('fromAgentCall', () => {
  it('flattens request turns and the response turn', () => {
    const call = {
      request: [msg({ role: 'system', content: 'sys' }), msg({ role: 'user', content: 'hi' })],
      response: msg({ role: 'assistant', content: 'yo' }),
    } as unknown as AgentCallDto;

    const out = fromAgentCall(call);

    expect(out.map(m => m.role)).toEqual(['system', 'user', 'assistant']);
    expect(out.map(m => m.content)).toEqual(['sys', 'hi', 'yo']);
  });

  it('maps tool requests into toolCalls and keeps tool result ids', () => {
    const call = {
      request: [msg({ role: 'tool', content: '{"ok":true}', toolCallId: 'call_1' })],
      response: msg({
        role: 'assistant',
        content: '',
        toolRequests: [{ id: 'call_1', name: 'lookup', arguments: '{"q":1}' }],
      }),
    } as unknown as AgentCallDto;

    const out = fromAgentCall(call);

    expect(out[0]).toMatchObject({ role: 'tool', toolCallId: 'call_1' });
    expect(out[1].toolCalls).toEqual([{ id: 'call_1', name: 'lookup', arguments: '{"q":1}' }]);
  });

  it('omits the response turn when absent', () => {
    const call = { request: [msg({ content: 'only' })], response: null } as unknown as AgentCallDto;
    expect(fromAgentCall(call)).toHaveLength(1);
  });
});

describe('fromTestCase', () => {
  it('appends the expected output labelled "Expected"', () => {
    const tc = {
      input: [{ role: 'user', content: 'q' }],
      expectedOutput: { role: 'assistant', content: 'a' },
    } as unknown as TestCaseDto;

    const out = fromTestCase(tc);

    expect(out).toHaveLength(2);
    expect(out[1]).toMatchObject({ role: 'assistant', content: 'a', label: 'Expected' });
  });

  it('pairs assistant tool calls with their tool results in the input', () => {
    const tc = {
      input: [
        { role: 'user', content: 'forecast it' },
        { role: 'assistant', content: '', toolRequests: [{ id: 'c1', name: 'arima', arguments: '{"d":90}' }] },
        { role: 'tool', content: '{"ok":true}', toolCallId: 'c1' },
      ],
      expectedOutput: { role: 'assistant', content: 'done' },
    } as unknown as TestCaseDto;

    const out = fromTestCase(tc);

    expect(out[1].toolCalls).toEqual([{ id: 'c1', name: 'arima', arguments: '{"d":90}' }]);
    expect(out[2]).toMatchObject({ role: 'tool', toolCallId: 'c1' });
  });
});

describe('fromFixtureInput', () => {
  it('maps fixture input messages', () => {
    const messages = [{ role: 'user', content: 'q' }, { role: 'tool', content: 'r' }];

    expect(fromFixtureInput(messages)).toEqual([
      { role: 'user', content: 'q', toolCalls: undefined, toolCallId: undefined },
      { role: 'tool', content: 'r', toolCalls: undefined, toolCallId: undefined },
    ]);
  });

  it('carries assistant tool requests and the tool result id so they pair up', () => {
    const messages = [
      { role: 'user', content: 'forecast it' },
      {
        role: 'assistant',
        content: '',
        toolRequests: [{ id: 'call_1', name: 'arima', arguments: '{"days":90}' }],
      },
      { role: 'tool', content: '{"ok":true}', toolCallId: 'call_1' },
    ];

    const out = fromFixtureInput(messages);

    expect(out[1].toolCalls).toEqual([{ id: 'call_1', name: 'arima', arguments: '{"days":90}' }]);
    expect(out[2]).toMatchObject({ role: 'tool', toolCallId: 'call_1' });
  });
});

describe('fromSimple', () => {
  it('keeps the original role string as the visible label and colours by base role', () => {
    const out = fromSimple([{ role: 'expected (assistant)', content: 'x' }]);
    expect(out[0]).toEqual({ role: 'assistant', content: 'x', label: 'expected (assistant)' });
  });
});
