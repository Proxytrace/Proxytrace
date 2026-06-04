import type { MessageDto, AgentCallDto } from '../../../api/models';
import { MessageBubble } from '../../../components/ui/MessageBubble';
import { ToolMessageBubble } from '../../../components/ui/ToolMessageBubble';
import { ToolResultBlock } from './ToolResultBlock';
import { fmtLatency } from '../../../lib/format';

interface Props {
  trace: AgentCallDto;
  allMessages: MessageDto[];
  toolResultByCallId: Map<string, MessageDto>;
  absorbedCallIds: Set<string>;
  onJumpToDefinition: (toolName: string) => void;
}

export function TraceMessagesTab({
  trace, allMessages, toolResultByCallId, absorbedCallIds, onJumpToDefinition,
}: Props) {
  return (
    <>
      {allMessages.flatMap((msg, i) => {
        if (msg.role === 'tool') {
          if (msg.toolCallId && absorbedCallIds.has(msg.toolCallId)) return [];
          return [<ToolResultBlock key={`m${i}`} msg={msg} />];
        }
        const blocks: React.ReactElement[] = [];
        if (msg.content?.trim()) {
          blocks.push(<MessageBubble key={`m${i}`} msg={msg} defaultOpen={msg.role !== 'system'} />);
        }
        msg.toolRequests?.forEach(req => {
          blocks.push(
            <ToolMessageBubble
              key={`t${req.id}`}
              request={req}
              result={toolResultByCallId.get(req.id)}
              defaultOpen={false}
              onJumpToDefinition={trace.agentId ? () => onJumpToDefinition(req.name) : undefined}
            />,
          );
        });
        return blocks;
      })}
      {trace.finishReason && (
        <div className="mt-1 px-3 py-2 bg-card-2 rounded-[8px] text-body-sm text-muted font-mono flex items-center gap-2">
          <span className="text-success">●</span>
          finish_reason: <span className="text-secondary">{trace.finishReason}</span>
          <span className="ml-auto">completed in {fmtLatency(trace.durationMs)}</span>
        </div>
      )}
    </>
  );
}
