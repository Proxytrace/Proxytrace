import { useEffect, useRef } from 'react';
import { SparklesIcon } from '../../../components/icons';
import { EditableMessageBubble } from './EditableMessageBubble';
import type { PlaygroundMessage, PlaygroundRole, PlaygroundToolOverride } from '../state/types';

interface Props {
  messages: PlaygroundMessage[];
  systemPrompt?: string;
  agentName?: string;
  tools?: PlaygroundToolOverride[];
  isStreaming: boolean;
  streamingId: string | null;
  onEdit: (localId: string, content: string) => void;
  onDelete: (localId: string) => void;
  onInsert: (atIndex: number, role: PlaygroundRole) => void;
  onReroll: (localId: string) => void;
}

export function ConversationView({
  messages,
  systemPrompt,
  agentName,
  tools,
  isStreaming,
  streamingId,
  onEdit,
  onDelete,
  onInsert,
  onReroll,
}: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    // auto-scroll to bottom while streaming
    el.scrollTop = el.scrollHeight;
  }, [messages, isStreaming]);

  if (messages.length === 0) {
    const trimmed = systemPrompt?.trim();
    return (
      <div className="flex-1 overflow-y-auto px-[16px] py-[24px] flex items-center justify-center">
        <div className="max-w-[560px] w-full flex flex-col gap-[16px] text-center">
          <div className="flex justify-center">
            <span
              className="inline-flex items-center justify-center size-[44px] rounded-full"
              style={{ background: 'var(--accent-subtle)', color: 'var(--accent-hover)' }}
            >
              <SparklesIcon size={20} strokeWidth={1.8} />
            </span>
          </div>
          <div>
            <div className="text-[15px] font-semibold text-primary">
              {agentName ? `Talk to ${agentName}` : 'Start a conversation'}
            </div>
            <div className="text-[12.5px] text-muted mt-[2px]">
              Type below to send a message, or load a real trace from the left rail.
            </div>
          </div>
          {trimmed && (
            <div
              className="rounded-[10px] text-left p-[12px] text-[12px] leading-[1.55] text-secondary"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}
            >
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted mb-[4px]">System prompt</div>
              <div className="whitespace-pre-wrap">{trimmed.length > 380 ? trimmed.slice(0, 377) + '…' : trimmed}</div>
            </div>
          )}
          {tools && tools.length > 0 && (
            <div className="flex flex-col gap-[6px]">
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted text-left">Tools available</div>
              <div className="flex flex-wrap gap-[6px] justify-start">
                {tools.map(t => (
                  <span
                    key={t.name}
                    className="inline-flex items-center gap-[5px] px-[8px] py-[3px] rounded-full text-[11px] mono"
                    style={{
                      background: 'rgba(16,185,129,0.08)',
                      border: '1px solid rgba(16,185,129,0.22)',
                      color: '#86efac',
                    }}
                    title={t.description}
                  >
                    {t.name}
                    <span className="text-muted text-[10px]">{t.arguments.length}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollerRef} className="flex-1 overflow-y-auto px-[14px] py-[14px] flex flex-col gap-[10px]">
      {messages.map((m, i) => (
        <EditableMessageBubble
          key={m.localId}
          message={m}
          turnIndex={i + 1}
          canReroll={m.role === 'user' || m.role === 'system'}
          isStreaming={isStreaming && m.localId === streamingId}
          onEdit={content => onEdit(m.localId, content)}
          onDelete={() => onDelete(m.localId)}
          onInsertAbove={() => onInsert(i, 'user')}
          onInsertBelow={() => onInsert(i + 1, 'user')}
          onReroll={() => onReroll(m.localId)}
        />
      ))}
    </div>
  );
}
