import { useThread } from '@assistant-ui/react';
import { Trans } from '@lingui/react/macro';
import { SparklesIcon } from '../../../components/icons';
import { Button } from '../../../components/ui/Button';
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
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-accent-subtle text-accent ring-1 ring-[color-mix(in_srgb,var(--accent-primary)_22%,transparent)]">
            <SparklesIcon size={16} />
          </span>
          <div>
            <div className="text-h2 font-semibold leading-tight text-primary"><Trans>Tracey AI</Trans></div>
            <div className="text-body-sm text-muted"><Trans>Your in-app assistant</Trans></div>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col pb-3 pt-1">
        {pendingConfirmation && (
          <div className="mx-auto mt-2 w-full max-w-3xl px-4">
            <div className="rounded-lg border border-[color-mix(in_srgb,var(--warn)_35%,transparent)] bg-warn-subtle px-3 py-2.5">
              <div className="text-title text-primary">{pendingConfirmation.summary}</div>
              <div className="mt-2 flex gap-2">
                <Button variant="primary" size="sm" onClick={() => resolveConfirmation(true)}>
                  <Trans>Confirm</Trans>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => resolveConfirmation(false)}>
                  <Trans>Cancel</Trans>
                </Button>
              </div>
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
