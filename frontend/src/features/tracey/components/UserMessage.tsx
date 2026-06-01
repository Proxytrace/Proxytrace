import { MessagePrimitive } from '@assistant-ui/react';
import type { TextMessagePartComponent } from '@assistant-ui/react';
import { ToolCallCard } from './ToolCallCard';
import { TRACEY_TOOL_UI } from './tool-ui/registry';

/** User text is shown verbatim (assistant text is Markdown — see {@link AssistantMessage}). */
const PlainText: TextMessagePartComponent = ({ text }) => (
  <span className="whitespace-pre-wrap break-words">{text}</span>
);

const userParts = { Text: PlainText, tools: { by_name: TRACEY_TOOL_UI, Fallback: ToolCallCard } };

export function UserMessage() {
  return (
    <MessagePrimitive.Root className="flex justify-end">
      <div className="max-w-[80%] rounded-xl rounded-br-sm bg-accent px-3.5 py-2 text-[13px] text-white">
        <MessagePrimitive.Parts components={userParts} />
      </div>
    </MessagePrimitive.Root>
  );
}
