import { ThreadPrimitive, MessagePrimitive } from '@assistant-ui/react';
import type { TextMessagePartComponent, ToolCallMessagePartComponent } from '@assistant-ui/react';
import { SparklesIcon, ExpandIcon, ArrowDownIcon } from '../../components/icons';
import { useTraceyActions } from './tracey-actions';
import { resultToArtifact } from './tracey-artifacts';
import { MarkdownText } from './components/MarkdownText';

const PlainText: TextMessagePartComponent = ({ text }) => (
  <span className="whitespace-pre-wrap break-words">{text}</span>
);

/** Compact renderer for a tool call + its result, with a "Pin to panel" action. */
const ToolFallback: ToolCallMessagePartComponent = ({ toolName, result }) => {
  const { showArtifact } = useTraceyActions();
  const hasResult = result != null;
  // `show_*` tools already render into the panel and `navigate` returns no data worth pinning.
  const pinnable = hasResult && !toolName.startsWith('show_') && toolName !== 'navigate';

  return (
    <div className="my-1 rounded-md border border-hairline bg-card px-2.5 py-1.5 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-accent">{toolName}</span>
        {pinnable && (
          <button
            type="button"
            onClick={() => showArtifact(resultToArtifact(toolName, result))}
            className="inline-flex items-center gap-1 rounded-sm border border-border px-1.5 py-[2px] text-[10px] text-muted transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent-primary)_60%,transparent)] cursor-pointer"
          >
            <ExpandIcon size={11} />
            Pin to panel
          </button>
        )}
      </div>
      {hasResult && (
        <pre className="mt-1 max-h-40 overflow-auto text-[11px] text-muted whitespace-pre-wrap break-words">
          {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
};

// User text is shown verbatim; assistant text is rendered as Markdown.
const userParts = { Text: PlainText, tools: { Fallback: ToolFallback } };
const assistantParts = { Text: MarkdownText, tools: { Fallback: ToolFallback } };

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
      <div className="max-w-[80%] rounded-2xl rounded-bl-sm border border-hairline bg-card px-3.5 py-2 text-[13px] text-primary">
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
        <ThreadPrimitive.Empty>
          <div className="m-auto flex max-w-md flex-col items-center gap-3 text-center">
            <div className="flex size-11 items-center justify-center rounded-xl bg-accent-subtle text-accent">
              <SparklesIcon size={22} />
            </div>
            <div className="text-h2 font-semibold text-primary">How can I help?</div>
            <div className="text-[13px] text-secondary">
              Ask about your agents, suites, runs, or proposals — or have me run a suite, review a
              proposal, or plot your data. Type <span className="font-mono text-accent">/</span> for
              quick actions and tools.
            </div>
          </div>
        </ThreadPrimitive.Empty>

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
