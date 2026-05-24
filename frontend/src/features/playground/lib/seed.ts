import { agentCallsApi } from '../../../api/agent-calls';
import { testCasesApi } from '../../../api/test-cases';
import type { SearchHit } from '../../../api/search';
import type {
  AgentCallDto, MessageDto, TestCaseDto, TestSuiteMessageDto,
} from '../../../api/models';
import { makeMessage } from '../state/usePlaygroundSession';
import type { PlaygroundMessage, PlaygroundRole } from '../state/types';

export async function loadMessagesForHit(hit: SearchHit): Promise<PlaygroundMessage[]> {
  if (hit.kind === 'agentCall') {
    const call = await agentCallsApi.get(hit.entityId);
    return agentCallToMessages(call);
  }
  if (hit.kind === 'testCase') {
    const tc = await testCasesApi.get(hit.entityId);
    return testCaseToMessages(tc);
  }
  return [];
}

function roleFromString(role: string): PlaygroundRole {
  const lower = role.toLowerCase();
  if (lower === 'user' || lower === 'assistant' || lower === 'system' || lower === 'tool') return lower;
  return 'user';
}

function toPlaygroundMessage(m: MessageDto): PlaygroundMessage {
  const base = makeMessage(roleFromString(m.role), m.content ?? '');
  if (m.toolRequests && m.toolRequests.length > 0) {
    base.toolRequests = m.toolRequests.map(tr => ({ id: tr.id, name: tr.name, arguments: tr.arguments }));
  }
  if (m.toolCallId) base.toolCallId = m.toolCallId;
  return base;
}

function agentCallToMessages(call: AgentCallDto): PlaygroundMessage[] {
  const out: PlaygroundMessage[] = call.request.map(toPlaygroundMessage);
  if (call.response) out.push(toPlaygroundMessage(call.response));
  return out;
}

function testCaseToMessages(tc: TestCaseDto): PlaygroundMessage[] {
  const fromInput = (tc.input ?? []).map((m: TestSuiteMessageDto) =>
    makeMessage(roleFromString(m.role), m.content ?? ''));
  if (tc.expectedOutput) {
    fromInput.push(makeMessage(roleFromString(tc.expectedOutput.role), tc.expectedOutput.content ?? ''));
  }
  return fromInput;
}
