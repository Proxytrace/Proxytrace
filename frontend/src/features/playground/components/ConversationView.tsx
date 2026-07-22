import { useEffect, useRef, useState } from 'react';
import { Trans } from '@lingui/react/macro';
import { SparklesIcon } from '../../../components/icons';
import { EditableMessageBubble } from './EditableMessageBubble';
import { AddMessageBar } from './AddMessageBar';
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
  onMove: (fromId: string, toIndex: number) => void;
  onLoadFromTrace?: () => void;
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
  onMove,
  onLoadFromTrace,
}: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(messages.length);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  useEffect(() => {
    // Only stick to the bottom when a turn is appended or while streaming —
    // not on delete, edit, or reorder.
    const grew = messages.length > prevCountRef.current;
    prevCountRef.current = messages.length;
    if (!grew && !isStreaming) return;
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, isStreaming]);

  const handleDragStart = (id: string) => {
    setDraggingId(id);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDropIndex(null);
  };

  const handleBubbleDragOver = (e: React.DragEvent, index: number) => {
    if (!draggingId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const above = e.clientY < rect.top + rect.height / 2;
    setDropIndex(above ? index : index + 1);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggingId || dropIndex == null) {
      handleDragEnd();
      return;
    }
    onMove(draggingId, dropIndex);
    handleDragEnd();
  };

  if (messages.length === 0) {
    const trimmed = systemPrompt?.trim();
    return (
      <div data-testid="conversation-view" className="flex-1 overflow-y-auto px-4 py-6 flex items-center justify-center">
        <div className="max-w-[560px] w-full flex flex-col gap-4 text-center">
          <div className="flex justify-center">
            <span
              className="inline-flex items-center justify-center size-[44px] rounded-none bg-accent-subtle text-accent-hover"
            >
              <SparklesIcon size={20} strokeWidth={1.8} />
            </span>
          </div>
          <div>
            <div className="text-h2 font-semibold text-primary">
              {agentName ? <Trans>Talk to {agentName}</Trans> : <Trans>Start a conversation</Trans>}
            </div>
            <div className="text-body text-muted mt-0.5">
              <Trans>Type below to send a message, or use Add message to insert turns manually.</Trans>
            </div>
          </div>
          {trimmed && (
            <div
              className="rounded-md text-left p-3 text-body leading-[1.55] text-secondary bg-white/[0.02] border border-border"
            >
              <div className="text-caption font-semibold uppercase tracking-[0.08em] text-secondary mb-1"><Trans>System prompt</Trans></div>
              <div className="whitespace-pre-wrap">{trimmed.length > 380 ? trimmed.slice(0, 377) + '…' : trimmed}</div>
            </div>
          )}
          {tools && tools.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="text-caption font-semibold uppercase tracking-[0.08em] text-secondary text-left"><Trans>Tools available</Trans></div>
              <div className="flex flex-wrap gap-1.5 justify-start">
                {tools.map(t => (
                  <span
                    key={t.name}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-none text-body-sm mono bg-success-subtle border border-[color-mix(in_srgb,var(--success)_28%,transparent)] text-success"
                    title={t.description}
                  >
                    {t.name}
                    <span className="text-muted text-caption">{t.arguments.length}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="mt-1.5">
            <AddMessageBar onAdd={role => onInsert(0, role)} onLoadFromTrace={onLoadFromTrace} />
          </div>
        </div>
      </div>
    );
  }

  const dropIndicator = (
    <div
      aria-hidden
      className="h-[2px] mx-0.5 bg-accent"
    />
  );

  return (
    <div
      ref={scrollerRef}
      data-testid="conversation-view"
      className="flex-1 overflow-y-auto px-3.5 py-3.5 flex flex-col gap-2.5"
      onDragOver={e => {
        // Allow drop in the empty area at the bottom of the list.
        if (!draggingId) return;
        const target = e.target as HTMLElement;
        if (target === e.currentTarget) {
          e.preventDefault();
          setDropIndex(messages.length);
        }
      }}
      onDrop={handleDrop}
    >
      {messages.map((m, i) => (
        <div key={m.localId}>
          {dropIndex === i && draggingId && draggingId !== m.localId && dropIndicator}
          <EditableMessageBubble
            message={m}
            isStreaming={isStreaming && m.localId === streamingId}
            isDragging={draggingId === m.localId}
            onEdit={content => onEdit(m.localId, content)}
            onDelete={() => onDelete(m.localId)}
            onDragStart={() => handleDragStart(m.localId)}
            onDragEnd={handleDragEnd}
            onDragOverBubble={e => handleBubbleDragOver(e, i)}
            onDrop={handleDrop}
          />
        </div>
      ))}
      {dropIndex === messages.length && draggingId && dropIndicator}
      <AddMessageBar onAdd={role => onInsert(messages.length, role)} onLoadFromTrace={onLoadFromTrace} />
    </div>
  );
}
