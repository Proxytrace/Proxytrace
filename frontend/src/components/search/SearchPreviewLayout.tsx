import { ROLE_COLOR, baseRole } from './searchMeta';

// ---------------------------------------------------------------------------
// PreviewSection: titled content block
// ---------------------------------------------------------------------------

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

export function PreviewSection({ title, children }: SectionProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">{title}</div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Conversation: list of chat messages
// ---------------------------------------------------------------------------

interface ConversationMessage {
  role: string;
  content: string;
}

interface ConversationProps {
  messages: ConversationMessage[];
}

export function Conversation({ messages }: ConversationProps) {
  if (messages.length === 0) {
    return <div className="text-[11.5px] text-white/40 italic">No messages.</div>;
  }
  return (
    <div className="flex flex-col gap-2">
      {messages.map((m, i) => {
        const color = ROLE_COLOR[baseRole(m.role)] ?? 'var(--text-secondary)';
        return (
          <div
            key={i}
            className="rounded-md border border-white/[.06] bg-white/[.02] p-2 flex flex-col gap-1"
          >
            <span
              className="text-[9.5px] uppercase tracking-[0.08em] font-semibold"
              style={{ color }}
            >
              {m.role}
            </span>
            <div className="text-[11.5px] text-white/80 leading-relaxed whitespace-pre-wrap break-words line-clamp-6">
              {m.content || <span className="text-white/30 italic">empty</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
