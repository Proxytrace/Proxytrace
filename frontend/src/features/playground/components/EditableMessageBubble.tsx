import { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { EditIcon, GripVerticalIcon, TrashIcon } from '../../../components/icons';
import { ToolCallBlock } from '../../../components/conversation/ToolCallBlock';
import { MessageBubble } from '../../../components/ui/MessageBubble';
import { IconButton } from '../../../components/ui/Button';
import { cn } from '../../../lib/cn';
import { TurnEditor } from './TurnEditor';
import type { PlaygroundMessage } from '../state/types';

interface Props {
  message: PlaygroundMessage;
  isStreaming: boolean;
  isDragging?: boolean;
  onEdit: (content: string) => void;
  onDelete: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDragOverBubble?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

/**
 * A turn in the playground conversation: the shared `MessageBubble` (same renderer as the
 * trace detail drawer) wrapped with playground-only affordances — edit-in-place, delete,
 * and drag-to-reorder. Tool calls render through the shared `ToolCallBlock`.
 */
export function EditableMessageBubble(props: Props) {
  const { t } = useLingui();
  const {
    message, isStreaming, isDragging,
    onEdit, onDelete,
    onDragStart, onDragEnd, onDragOverBubble, onDrop,
  } = props;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const draggable = !editing && !isStreaming && !!onDragStart;

  const beginEdit = () => { setDraft(message.content); setEditing(true); };
  const saveEdit = () => { onEdit(draft); setEditing(false); };

  const actions = !isStreaming && (
    <span className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-[var(--motion-fast)]">
      {draggable && (
        <span aria-hidden title={t`Drag to reorder`} className="inline-flex text-muted cursor-grab px-0.5">
          <GripVerticalIcon size={12} />
        </span>
      )}
      {message.errored && (
        <span className="text-caption text-danger mono uppercase tracking-[0.05em] mr-1"><Trans>error</Trans></span>
      )}
      <IconButton size="sm" title={t`Edit`} onClick={beginEdit} aria-label={t`Edit`} data-testid="editable-message-edit">
        <EditIcon size={12} strokeWidth={2.2} />
      </IconButton>
      <IconButton size="sm" danger title={t`Delete`} onClick={onDelete} aria-label={t`Delete`}>
        <TrashIcon size={12} strokeWidth={2.2} />
      </IconButton>
    </span>
  );

  const isEmpty = !message.content.trim() && (!message.toolRequests || message.toolRequests.length === 0);
  const toolLabel = message.role === 'tool' && message.toolCallId
    // eslint-disable-next-line lingui/no-unlocalized-strings -- compact technical badge (role marker + tool-call id)
    ? `TOOL · ${message.toolCallId.slice(0, 10)}`
    : undefined;

  return (
    <div
      data-testid={`editable-message-bubble-${message.localId}`}
      data-role={message.role}
      draggable={draggable}
      onDragStart={e => {
        if (!draggable) return;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', message.localId);
        onDragStart?.();
      }}
      onDragEnd={() => onDragEnd?.()}
      onDragOver={e => onDragOverBubble?.(e)}
      onDrop={e => onDrop?.(e)}
      className={cn('flex flex-col gap-1.5 transition-opacity duration-150', isDragging && 'opacity-40')}
    >
      {editing ? (
        <TurnEditor draft={draft} setDraft={setDraft} onCancel={() => setEditing(false)} onSave={saveEdit} />
      ) : (
        <>
          {isEmpty && !isStreaming ? (
            <EmptyTurn role={message.role} actions={actions} />
          ) : (
            <MessageBubble
              key={isStreaming ? 'streaming' : 'final'}
              msg={message}
              label={toolLabel}
              streaming={isStreaming}
              actions={actions}
            />
          )}
          {message.toolRequests?.map(tr => (
            <ToolCallBlock key={tr.id} name={tr.name} id={tr.id} arguments={tr.arguments} />
          ))}
          {message.toolError && (
            <div className="text-body mono px-2.5 py-2 rounded-md bg-danger-subtle border border-[color-mix(in_srgb,var(--danger)_28%,transparent)] text-danger">
              {message.toolError}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** The shared bubble hides itself when content is empty — keep an editable placeholder visible. */
function EmptyTurn({ role, actions }: { role: string; actions: React.ReactNode }) {
  return (
    <div className="group relative rounded-lg bg-card-2 border border-border border-dashed flex items-center gap-2 px-3 py-2.5">
      <span className="font-mono text-caption font-bold tracking-[0.08em] text-muted uppercase">{role}</span>
      <span className="text-body text-muted italic"><Trans>(empty — click edit to add content)</Trans></span>
      <span className="ml-auto" />
      {actions}
    </div>
  );
}
