import type { TraceyChat } from '../useTraceyChat';
import { TraceyConversation } from '../TraceyConversation';
import { TraceyComposer } from './TraceyComposer';

interface TraceyChatPanelProps {
  chat: TraceyChat;
}

/** The chat column: header controls, pending-confirmation card, message list, composer. */
export function TraceyChatPanel({ chat }: TraceyChatPanelProps) {
  const { autoApprove, setAutoApprove, clear, pendingConfirmation, resolveConfirmation } = chat;

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border bg-surface-2">
      <header className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-2.5">
        <div>
          <div className="text-h2 font-semibold text-primary">Tracey AI</div>
          <div className="text-body-sm text-muted">Your in-app assistant</div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-secondary">
            <input
              type="checkbox"
              checked={autoApprove}
              onChange={e => setAutoApprove(e.target.checked)}
              className="accent-[var(--accent-primary)]"
            />
            Auto-approve actions
          </label>
          <button onClick={clear} className="btn-ghost px-2 py-1 text-xs">
            Clear conversation
          </button>
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
        <TraceyComposer />
      </div>
    </div>
  );
}
