import { ThreadPrimitive, MessagePrimitive } from '@assistant-ui/react';
import { MarkdownText } from './MarkdownText';
import { ToolCallCard } from './ToolCallCard';
import { TraceLink } from './TraceLink';
import { TRACEY_TOOL_UI } from './tool-ui/registry';

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

// Assistant text is rendered as Markdown; tools with a dedicated inline UI render via `by_name`,
// everything else falls back to the diagnostic tool card.
const assistantParts = { Text: MarkdownText, tools: { by_name: TRACEY_TOOL_UI, Fallback: ToolCallCard } };

export function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="flex justify-start">
      <div className="flex min-w-0 flex-1 flex-col gap-3 text-[13px] text-primary">
        <MessagePrimitive.Parts components={assistantParts} />
        {/* Once the turn finishes, its correlation id lands on the message metadata and TraceLink
            renders; while streaming it's absent, so this stays hidden. */}
        <TraceLink />
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
