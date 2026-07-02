import { ThreadPrimitive } from '@assistant-ui/react';
import { Trans, useLingui } from '@lingui/react/macro';
import { ArrowDownIcon } from '../../components/icons';
import { AssistantMessage } from './components/AssistantMessage';
import { UserMessage } from './components/UserMessage';

/** The scrolling message list (composer lives in {@link TraceyComposer}). */
export function TraceyConversation() {
  const { t } = useLingui();
  return (
    <ThreadPrimitive.Root className="relative flex flex-1 min-h-0 flex-col">
      {/* The viewport scrolls the full panel width so the scrollbar sits in the panel gutter,
          not glued to the text. `scrollbar-gutter: stable both-edges` reserves symmetric space so
          the centered message column stays aligned with the composer (which has no scrollbar). */}
      <ThreadPrimitive.Viewport
        autoScroll
        className="flex w-full flex-1 min-h-0 flex-col overflow-y-auto [scrollbar-gutter:stable_both-edges]"
      >
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-5">
          <ThreadPrimitive.Messages components={{ UserMessage, AssistantMessage }} />
          {/* Busy signal at the end of the flow while Tracey is mid-turn (streaming or running
              tools); replaces the per-message typing dots so it shows through tool steps too. */}
          <ThreadPrimitive.If running>
            <div
              className="fade-up flex items-center gap-2 text-body-sm text-secondary"
              data-testid="tracey-busy-indicator"
            >
              <span className="flex items-center gap-1" aria-hidden>
                {[0, 1, 2].map(i => (
                  <span
                    key={i}
                    className="pulse-dot size-1.5 rounded-full bg-accent"
                    // Negative delay phase-shifts each dot immediately, so the wave reads from the first frame.
                    style={{ animationDelay: `${i * -220}ms` }}
                  />
                ))}
              </span>
              <Trans>Thinking…</Trans>
            </div>
          </ThreadPrimitive.If>
        </div>
      </ThreadPrimitive.Viewport>

      <ThreadPrimitive.ScrollToBottom asChild>
        {/* eslint-disable-next-line no-restricted-syntax -- assistant-ui ScrollToBottom asChild target; native button with bespoke floating style */}
        <button
          type="button"
          aria-label={t`Scroll to latest`}
          className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full border border-border bg-card p-1.5 text-muted shadow-[var(--shadow-float)] transition-colors hover:text-primary disabled:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent-primary)_60%,transparent)] cursor-pointer"
        >
          <ArrowDownIcon size={16} />
        </button>
      </ThreadPrimitive.ScrollToBottom>
    </ThreadPrimitive.Root>
  );
}
