import { ThreadPrimitive, MessagePrimitive, ComposerPrimitive } from '@assistant-ui/react';
import type { TextMessagePartComponent, ToolCallMessagePartComponent } from '@assistant-ui/react';
import { SparklesIcon } from '../../components/icons';

const TextPart: TextMessagePartComponent = ({ text }) => (
  <span className="whitespace-pre-wrap break-words">{text}</span>
);

/** Compact renderer for a tool call + its result inside an assistant message. */
const ToolFallback: ToolCallMessagePartComponent = ({ toolName, result }) => (
  <div className="my-1 rounded-md border border-hairline bg-card px-2.5 py-1.5 text-xs">
    <div className="font-mono text-[11px] text-accent">{toolName}</div>
    {result != null && (
      <pre className="mt-1 max-h-40 overflow-auto text-[11px] text-muted whitespace-pre-wrap break-words">
        {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
      </pre>
    )}
  </div>
);

const messageParts = { Text: TextPart, ToolGroup: undefined, tools: { Fallback: ToolFallback } };

function UserMessage() {
  return (
    <MessagePrimitive.Root className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-accent px-3 py-2 text-[13px] text-white">
        <MessagePrimitive.Parts components={messageParts} />
      </div>
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="flex justify-start gap-2">
      <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-accent">
        <SparklesIcon size={13} />
      </div>
      <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-card border border-hairline px-3 py-2 text-[13px] text-primary">
        <MessagePrimitive.Parts components={messageParts} />
      </div>
    </MessagePrimitive.Root>
  );
}

export function TraceyConversation() {
  return (
    <ThreadPrimitive.Root className="flex h-full min-h-0 flex-col">
      <ThreadPrimitive.Viewport className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 px-1 py-2">
        <ThreadPrimitive.Empty>
          <div className="m-auto max-w-[80%] text-center text-sm text-muted">
            Hi, I'm Tracey. Ask me about your agents, suites, runs, or proposals — or tell me to
            run a suite or review a proposal.
          </div>
        </ThreadPrimitive.Empty>

        <ThreadPrimitive.Messages
          components={{ UserMessage, AssistantMessage }}
        />
      </ThreadPrimitive.Viewport>

      <ComposerPrimitive.Root className="mt-2 flex items-end gap-2 rounded-xl border border-border bg-card px-2 py-1.5">
        <ComposerPrimitive.Input
          autoFocus
          placeholder="Ask Tracey…"
          className="flex-1 resize-none bg-transparent px-1 py-1.5 text-[13px] text-primary outline-none placeholder:text-muted"
        />
        <ComposerPrimitive.Send className="btn-primary shrink-0 px-3 py-1.5 text-xs">
          Send
        </ComposerPrimitive.Send>
      </ComposerPrimitive.Root>
    </ThreadPrimitive.Root>
  );
}
