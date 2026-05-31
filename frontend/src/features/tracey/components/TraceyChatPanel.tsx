import { useThread } from '@assistant-ui/react';
import { cn } from '../../../lib/cn';
import type { TraceyChat } from '../useTraceyChat';
import { TraceyConversation } from '../TraceyConversation';
import { TraceyComposer } from './TraceyComposer';

interface TraceyChatPanelProps {
  chat: TraceyChat;
}

/** The chat column: header controls, pending-confirmation card, message list, composer. */
export function TraceyChatPanel({ chat }: TraceyChatPanelProps) {
  const { autoApprove, setAutoApprove, clear, pendingConfirmation, resolveConfirmation } = chat;
  // Empty thread → "initial view": composer floats toward the middle with starter chips. The
  // bottom spacer animates to 0 on the first message (and back when the conversation is cleared),
  // which slides the composer down to / up from the bottom.
  const isEmpty = useThread(t => t.messages.length === 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border bg-surface-2">
      <header className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-2.5">
        <div>
          <div className="text-h2 font-semibold text-primary">Tracey AI</div>
          <div className="text-body-sm text-muted">Your in-app assistant</div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-1">
        {pendingConfirmation && (
          <div className="mx-auto mt-2 w-full max-w-3xl rounded-lg border border-[color-mix(in_srgb,var(--warn)_35%,transparent)] bg-warn-subtle px-3 py-2.5">
            <div className="text-[13px] text-primary">{pendingConfirmation.summary}</div>
            <div className="mt-2 flex gap-2">
              <button onClick={() => resolveConfirmation(true)} className="btn-primary px-3 py-1 text-xs">
                Confirm
              </button>
              <button onClick={() => resolveConfirmation(false)} className="btn-ghost px-3 py-1 text-xs">
                Cancel
              </button>
            </div>
          </div>
        )}

        <TraceyConversation />
        <TraceyComposer
          autoApprove={autoApprove}
          setAutoApprove={setAutoApprove}
          onClear={clear}
          showStarters={isEmpty}
        />
        <div
          aria-hidden
          className={cn(
            'shrink-0 transition-[height] duration-[var(--motion-slow)] ease-[var(--ease-standard)] motion-reduce:transition-none',
            isEmpty ? 'h-[34vh]' : 'h-0',
          )}
        />
      </div>
    </div>
  );
}
