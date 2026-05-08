import type { AgentCallDto, MessageDto } from '../../../api/models';
import { MessageBubble } from '../../../components/ui/MessageBubble';
import { ToolMessageBubble } from '../../../components/ui/ToolMessageBubble';
import { Collapsible } from '../../../components/ui/Collapsible';
import { JsonBlock } from '../../../components/ui/JsonBlock';
import { EmptyState } from '../../../components/ui/EmptyState';

function ToolResultBlock({ msg }: { msg: MessageDto }) {
  let parsed: unknown = msg.content;
  try { parsed = JSON.parse(msg.content); } catch { /* leave as string */ }
  const sizeB = msg.content?.length ?? 0;
  return (
    <div className="rounded-[10px] overflow-hidden" style={{ background: 'rgba(8,145,178,0.06)', border: '1px solid rgba(6,182,212,0.22)' }}>
      <Collapsible
        defaultOpen
        headerClassName="px-3 py-[9px] text-[11.5px] font-mono"
        contentClassName="px-[14px] pt-[10px] pb-3 pl-[34px] font-mono text-[11.5px] leading-[1.55]"
        title={
          <span className="flex items-center gap-2 flex-1" style={{ color: '#67e8f9' }}>
            <span className="font-bold tracking-[0.04em]" style={{ color: '#06b6d4' }}>RESULT</span>
            <span className="font-semibold" style={{ color: '#cffafe' }}>{msg.toolCallId?.slice(0, 12) ?? '—'}</span>
            <span className="ml-auto text-[10px] font-mono" style={{ color: '#52525b' }}>{sizeB} B</span>
          </span>
        }
      >
        <div style={{ borderTop: '1px dashed rgba(6,182,212,0.18)' }}>
          <div className="mt-[10px]">
            <JsonBlock value={parsed} hideCopy transparent className="!px-0 !py-0" />
          </div>
        </div>
      </Collapsible>
    </div>
  );
}

interface Props {
  trace: AgentCallDto | null;
}

export function TracePreviewPanel({ trace }: Props) {
  if (!trace) {
    return (
      <div className="h-full flex items-center justify-center">
        <EmptyState title="Select a trace to preview" description="Click a row to inspect its conversation." />
      </div>
    );
  }

  const allMessages: MessageDto[] = [...trace.request, ...(trace.response ? [trace.response] : [])];
  const toolResultByCallId = new Map<string, MessageDto>();
  for (const m of allMessages) if (m.role === 'tool' && m.toolCallId) toolResultByCallId.set(m.toolCallId, m);
  const invocations = allMessages.flatMap(m =>
    (m.toolRequests ?? []).map(req => ({ req, result: toolResultByCallId.get(req.id) }))
  );
  const absorbedCallIds = new Set(invocations.map(i => i.req.id));

  return (
    <div className="h-full min-h-0 overflow-y-auto px-4 py-4 flex flex-col gap-[10px] [&>*]:shrink-0">
      {allMessages.flatMap((msg, i) => {
        if (msg.role === 'tool') {
          if (msg.toolCallId && absorbedCallIds.has(msg.toolCallId)) return [];
          return [<ToolResultBlock key={`m${i}`} msg={msg} />];
        }
        const blocks: React.ReactElement[] = [];
        if (msg.content?.trim()) blocks.push(<MessageBubble key={`m${i}`} msg={msg} />);
        msg.toolRequests?.forEach(req => {
          blocks.push(
            <ToolMessageBubble
              key={`t${req.id}`}
              request={req}
              result={toolResultByCallId.get(req.id)}
            />
          );
        });
        return blocks;
      })}
    </div>
  );
}
