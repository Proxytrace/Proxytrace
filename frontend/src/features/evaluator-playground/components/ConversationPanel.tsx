import type { MessageDto } from '../../../api/models';
import { MessageBubble } from '../../../components/ui/MessageBubble';
import { TestBenchChevronIcon } from '../../../components/icons';

/** Collapsible transcript of the input conversation the case was scored against. */
export function ConversationPanel({ messages }: { messages: MessageDto[] }) {
  return (
    <details className="group rounded-lg border border-hairline bg-card-2 shrink-0">
      <summary className="flex items-center gap-2 px-3 py-2.5 cursor-pointer select-none list-none">
        <TestBenchChevronIcon />
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-secondary">Input conversation</span>
        <span className="text-[10.5px] text-muted font-mono">
          {messages.length} {messages.length === 1 ? 'message' : 'messages'}
        </span>
        <span className="ml-auto text-[11px] text-muted">
          <span className="group-open:hidden">Show</span>
          <span className="hidden group-open:inline">Hide</span>
        </span>
      </summary>
      <div className="px-3 pb-3 max-h-[240px] overflow-auto">
        {messages.length === 0 ? (
          <div className="text-body text-muted">No messages.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {messages.map((m, i) => (
              <MessageBubble key={`${m.role}:${m.content}`} msg={m} defaultOpen={i === messages.length - 1} />
            ))}
          </div>
        )}
      </div>
    </details>
  );
}
