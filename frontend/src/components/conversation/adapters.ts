import type {
  AgentCallDto,
  MessageDto,
  TestCaseDto,
  TestCaseMessageFixtureDto,
} from '../../api/models';
import type { ConversationMessage, ConversationRole, ConversationToolCall } from './types';

/** Coerce an arbitrary role string to a known conversation role (defaults to assistant). */
function toRole(role: string): ConversationRole {
  const r = role.toLowerCase();
  if (r === 'user' || r === 'system' || r === 'tool') return r;
  return 'assistant';
}

function toolCalls(m: MessageDto): ConversationToolCall[] | undefined {
  if (!m.toolRequests || m.toolRequests.length === 0) return undefined;
  return m.toolRequests.map(tr => ({ id: tr.id, name: tr.name, arguments: tr.arguments }));
}

/** A captured LLM trace: request turns followed by the response turn. */
export function fromAgentCall(call: AgentCallDto): ConversationMessage[] {
  const msgs = [...call.request, ...(call.response ? [call.response] : [])];
  return msgs.map(m => ({
    role: toRole(m.role),
    content: m.content ?? '',
    toolCalls: toolCalls(m),
    toolCallId: m.toolCallId,
  }));
}

/** A curated test case: its input turns plus the expected output (labelled "Expected"). */
export function fromTestCase(tc: TestCaseDto): ConversationMessage[] {
  return [
    ...tc.input.map(m => ({ role: toRole(m.role), content: m.content })),
    { role: toRole(tc.expectedOutput.role), content: tc.expectedOutput.content, label: 'Expected' },
  ];
}

/** The input conversation of a run fixture (expected/actual outputs are compared separately). */
export function fromFixtureInput(messages: TestCaseMessageFixtureDto[]): ConversationMessage[] {
  return messages.map(m => ({ role: toRole(m.role), content: m.content }));
}

/**
 * A flat list of role/content pairs (search previews). The original role string is kept
 * as the visible label so qualifiers like "expected (assistant)" survive.
 */
export function fromSimple(messages: { role: string; content: string }[]): ConversationMessage[] {
  return messages.map(m => ({ role: toRole(m.role), content: m.content, label: m.role }));
}
