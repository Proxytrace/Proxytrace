import { ThreadPrimitive, MessagePrimitive } from '@assistant-ui/react';
import type { TextMessagePartComponent } from '@assistant-ui/react';
import { SparklesIcon, ArrowDownIcon } from '../../components/icons';
import { MarkdownText } from './components/MarkdownText';
import { ToolCallCard } from './components/ToolCallCard';

const PlainText: TextMessagePartComponent = ({ text }) => (
  <span className="whitespace-pre-wrap break-words">{text}</span>
);

// User text is shown verbatim; assistant text is rendered as Markdown.
const userParts = { Text: PlainText, tools: { Fallback: ToolCallCard } };
const assistantParts = { Text: MarkdownText, tools: { Fallback: ToolCallCard } };

function UserMessage() {
  return (
    <MessagePrimitive.Root className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-accent px-3.5 py-2 text-[13px] text-white">
        <MessagePrimitive.Parts components={userParts} />
      </div>
    </MessagePrimitive.Root>
  );
}

/** Three pulsing dots shown while Tracey is thinking but hasn't streamed visible content yet. */
function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      <span className="size-1.5 animate-pulse rounded-full bg-muted [animation-delay:0ms]" />
      <span className="size-1.5 animate-pulse rounded-full bg-muted [animation-delay:150ms]" />
      <span className="size-1.5 animate-pulse rounded-full bg-muted [animation-delay:300ms]" />
    </div>
  );
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="flex justify-start gap-2.5">
      <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-accent">
        <SparklesIcon size={14} />
      </div>
      <div className="min-w-0 flex-1 pt-0.5 text-[13px] text-primary">
        <MessagePrimitive.Parts components={assistantParts} />
        {/* Only the still-empty last message while the run is active shows the thinking dots. */}
        <MessagePrimitive.If last hasContent={false}>
          <ThreadPrimitive.If running>
            <TypingDots />
          </ThreadPrimitive.If>
        </MessagePrimitive.If>
      </div>
    </MessagePrimitive.Root>
  );
}

/** The scrolling message list (composer lives in {@link TraceyComposer}). */
export function TraceyConversation() {
  return (
    <ThreadPrimitive.Root className="relative flex flex-1 min-h-0 flex-col">
      <ThreadPrimitive.Viewport
        autoScroll
        className="mx-auto flex w-full max-w-3xl flex-1 min-h-0 flex-col gap-4 overflow-y-auto px-2 py-4"
      >
        <ThreadPrimitive.Messages components={{ UserMessage, AssistantMessage }} />
      </ThreadPrimitive.Viewport>

      <ThreadPrimitive.ScrollToBottom asChild>
        <button
          type="button"
          aria-label="Scroll to latest"
          className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full border border-border bg-card p-1.5 text-muted shadow-[var(--shadow-float)] transition-colors hover:text-primary disabled:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent-primary)_60%,transparent)] cursor-pointer"
        >
          <ArrowDownIcon size={16} />
        </button>
      </ThreadPrimitive.ScrollToBottom>
    </ThreadPrimitive.Root>
  );
}
