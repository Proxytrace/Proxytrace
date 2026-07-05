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
    <MessagePrimitive.Root className="fade-up flex justify-end">
      {/* Gold fill carries dark accent-ink text per DESIGN.md — never white on gold. The
          dimensional gradient + button under-glow give the bubble the same finish as a primary
          CTA; text sits at the chat reading tier (DESIGN.md "Tracey exception"). */}
      <div className="max-w-[80%] rounded-xl rounded-br-sm bg-[image:var(--grad-accent)] px-4 py-2.5 text-chat font-medium text-accent-ink shadow-[var(--shadow-btn)]">
        <MessagePrimitive.Parts components={userParts} />
      </div>
    </MessagePrimitive.Root>
  );
}
