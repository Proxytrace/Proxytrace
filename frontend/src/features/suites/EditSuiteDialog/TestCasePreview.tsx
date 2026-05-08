import type { AgentCallDto, MessageDto, TestCaseDto, TestSuiteMessageDto } from '../../../api/models';
import { MessageBubble } from '../../../components/ui/MessageBubble';
import { ToolMessageBubble } from '../../../components/ui/ToolMessageBubble';
import { EmptyState } from '../../../components/ui/EmptyState';

function toMsg(m: TestSuiteMessageDto): MessageDto {
  return { role: m.role, content: m.content, toolRequests: [], toolCallId: null };
}

interface CasePreviewProps {
  testCase: TestCaseDto;
}

export function TestCasePreview({ testCase }: CasePreviewProps) {
  const msgs = [...testCase.input.map(toMsg), toMsg(testCase.expectedOutput)];
  return (
    <div className="h-full min-h-0 overflow-y-auto px-4 py-4 flex flex-col gap-[10px] [&>*]:shrink-0">
      <div className="text-[10.5px] font-semibold text-muted uppercase tracking-[0.08em]">Conversation · {testCase.input.length} input · 1 expected</div>
      {msgs.map((m, i) => (
        <MessageBubble key={i} msg={m} />
      ))}
    </div>
  );
}

interface TracePreviewProps {
  trace: AgentCallDto;
}

export function TraceConversationPreview({ trace }: TracePreviewProps) {
  const allMessages: MessageDto[] = [...trace.request, ...(trace.response ? [trace.response] : [])];
  const toolResultByCallId = new Map<string, MessageDto>();
  for (const m of allMessages) if (m.role === 'tool' && m.toolCallId) toolResultByCallId.set(m.toolCallId, m);
  const invocations = allMessages.flatMap(m =>
    (m.toolRequests ?? []).map(req => ({ req, result: toolResultByCallId.get(req.id) }))
  );
  const absorbedCallIds = new Set(invocations.map(i => i.req.id));

  return (
    <div className="h-full min-h-0 overflow-y-auto px-4 py-4 flex flex-col gap-[10px] [&>*]:shrink-0">
      <div className="text-[10.5px] font-semibold text-muted uppercase tracking-[0.08em]">Trace preview · {trace.model}</div>
      {allMessages.flatMap((msg, i) => {
        if (msg.role === 'tool') {
          if (msg.toolCallId && absorbedCallIds.has(msg.toolCallId)) return [];
          return [<MessageBubble key={`m${i}`} msg={msg} />];
        }
        const blocks: React.ReactElement[] = [];
        if (msg.content?.trim()) blocks.push(<MessageBubble key={`m${i}`} msg={msg} />);
        msg.toolRequests?.forEach(req => {
          blocks.push(
            <ToolMessageBubble key={`t${req.id}`} request={req} result={toolResultByCallId.get(req.id)} />
          );
        });
        return blocks;
      })}
    </div>
  );
}

export function PreviewEmpty({ title, description }: { title: string; description?: string }) {
  return (
    <div className="h-full flex items-center justify-center">
      <EmptyState title={title} description={description} />
    </div>
  );
}
