import { Trans, Plural } from '@lingui/react/macro';
import type { MessageDto } from '../../../api/models';
import { MessageBubble } from '../../../components/ui/MessageBubble';
import { TestBenchChevronIcon } from '../../../components/icons';

/** Collapsible transcript of the input conversation the case was scored against. */
export function ConversationPanel({ messages }: { messages: MessageDto[] }) {
  return (
    <details className="group rounded-lg border border-hairline bg-card-2 shrink-0">
      <summary className="flex items-center gap-2 px-3 py-2.5 cursor-pointer select-none list-none">
        <TestBenchChevronIcon />
        <span className="text-body-sm font-semibold uppercase tracking-[0.06em] text-secondary"><Trans>Input conversation</Trans></span>
        <span className="text-caption text-muted font-mono">
          <Plural value={messages.length} one="# message" other="# messages" />
        </span>
        <span className="ml-auto text-body-sm text-muted">
          <span className="group-open:hidden"><Trans>Show</Trans></span>
          <span className="hidden group-open:inline"><Trans>Hide</Trans></span>
        </span>
      </summary>
      <div className="px-3 pb-3 max-h-[240px] overflow-auto">
        {messages.length === 0 ? (
          <div className="text-body text-muted"><Trans>No messages.</Trans></div>
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
