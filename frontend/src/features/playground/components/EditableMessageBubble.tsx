import { useState } from 'react';
import {
  CopyIcon,
  EditIcon,
  TrashIcon,
} from '../../../components/icons';
import { JsonBlock } from '../../../components/ui/JsonBlock';
import { formInputCls } from '../../../components/ui/classes';
import type { PlaygroundMessage, PlaygroundRole } from '../state/types';

interface RoleStyle {
  accent: string;
  bg: string;
  border: string;
  label: string;
  badge: string;
  icon: string;
}

const ROLE_STYLE: Record<PlaygroundRole, RoleStyle> = {
  user: {
    accent: 'var(--teal)',
    bg: 'linear-gradient(180deg, color-mix(in srgb, var(--teal) 8%, transparent), color-mix(in srgb, var(--teal) 3%, transparent))',
    border: 'color-mix(in srgb, var(--teal) 25%, transparent)',
    label: 'User',
    badge: 'color-mix(in srgb, var(--teal) 14%, transparent)',
    icon: 'U',
  },
  assistant: {
    accent: 'var(--accent-hover)',
    bg: 'linear-gradient(180deg, var(--accent-subtle), color-mix(in srgb, var(--accent-primary) 4%, transparent))',
    border: 'color-mix(in srgb, var(--accent-primary) 25%, transparent)',
    label: 'Assistant',
    badge: 'var(--accent-subtle)',
    icon: 'A',
  },
  system: {
    accent: 'var(--text-secondary)',
    bg: 'linear-gradient(180deg, var(--bg-wash-hover), rgba(255,255,255,0.015))',
    border: 'var(--border-color)',
    label: 'System',
    badge: 'var(--bg-wash-active)',
    icon: 'S',
  },
  tool: {
    accent: 'var(--success)',
    bg: 'linear-gradient(180deg, var(--success-subtle), color-mix(in srgb, var(--success) 4%, transparent))',
    border: 'color-mix(in srgb, var(--success) 25%, transparent)',
    label: 'Tool',
    badge: 'color-mix(in srgb, var(--success) 14%, transparent)',
    icon: 'T',
  },
};

interface Props {
  message: PlaygroundMessage;
  turnIndex: number;
  isStreaming: boolean;
  isDragging?: boolean;
  onEdit: (content: string) => void;
  onDelete: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDragOverBubble?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

export function EditableMessageBubble(props: Props) {
  const {
    message, turnIndex, isStreaming, isDragging,
    onEdit, onDelete,
    onDragStart, onDragEnd, onDragOverBubble, onDrop,
  } = props;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const style = ROLE_STYLE[message.role];
  const draggable = !editing && !isStreaming && !!onDragStart;

  const beginEdit = () => { setDraft(message.content); setEditing(true); };
  const saveEdit = () => { onEdit(draft); setEditing(false); };
  const copyContent = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(message.content).catch(() => {});
    }
  };

  const isEmpty = !message.content && (!message.toolRequests || message.toolRequests.length === 0);
  const showCursor = isStreaming;

  return (
    <div
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
      className={`group rounded-[14px] overflow-hidden focus-within:outline focus-within:outline-1${isStreaming ? ' streaming-border' : ''}`}
      style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
        boxShadow: 'var(--shadow-card)',
        outlineColor: style.border,
        opacity: isDragging ? 0.4 : 1,
        cursor: draggable ? 'grab' : 'default',
        transition: 'opacity 0.15s',
        ['--streaming-color' as string]: style.accent,
      }}
    >
      <div className="flex items-center gap-[8px] px-[12px] pt-[10px] pb-[8px]">
        {draggable && (
          <span
            aria-hidden
            title="Drag to reorder"
            className="text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            style={{ cursor: 'grab' }}
          >
            <GripIcon />
          </span>
        )}
        <span
          aria-hidden
          className="inline-flex items-center justify-center size-[24px] rounded-full text-[11px] font-bold shrink-0"
          style={{ background: style.badge, color: style.accent, border: `1px solid ${style.border}` }}
        >
          {style.icon}
        </span>
        <span className="text-[11.5px] font-semibold tracking-[0.02em]" style={{ color: style.accent }}>
          {style.label}
        </span>
        <span className="text-[10.5px] text-muted mono">·</span>
        <span className="text-[10.5px] text-muted mono">turn {turnIndex}</span>
        {message.toolCallId && (
          <span className="text-[10px] text-muted mono truncate" title={message.toolCallId}>
            id {message.toolCallId.slice(0, 10)}
          </span>
        )}
        {message.errored && (
          <span className="text-[10px] text-danger mono uppercase tracking-[0.05em]">error</span>
        )}
        <div className="ml-auto flex items-center gap-[2px] opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
          <button type="button" className="btn-icon" title="Edit" onClick={beginEdit} aria-label="Edit">
            <EditIcon size={12} strokeWidth={2.2} />
          </button>
          <button type="button" className="btn-icon" title="Copy to clipboard" onClick={copyContent} aria-label="Copy to clipboard">
            <CopyIcon size={12} strokeWidth={2.2} />
          </button>
          <button type="button" className="btn-icon btn-icon-danger" title="Delete" onClick={onDelete} aria-label="Delete">
            <TrashIcon size={12} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      <div className="px-[16px] pb-[12px]">
        {editing ? (
          <div className="flex flex-col gap-[8px]">
            <textarea
              className={`${formInputCls} resize-y mono text-[12.5px]`}
              rows={Math.min(20, Math.max(3, draft.split('\n').length + 1))}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              autoFocus
            />
            <div className="flex items-center gap-2 justify-end">
              <button className="btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
              <button className="btn-primary" onClick={saveEdit}>Save</button>
            </div>
          </div>
        ) : (
          <>
            {(message.content || showCursor) && (
              <div className="text-[13.5px] leading-[1.7] whitespace-pre-wrap text-primary">
                {message.content}
                {showCursor && (
                  <span
                    aria-hidden
                    className="inline-block w-[8px] h-[15px] align-text-bottom ml-[1px] motion-reduce:animate-none"
                    style={{
                      background: style.accent,
                      animation: 'pulse-dot 0.9s ease-in-out infinite',
                      borderRadius: '1px',
                    }}
                  />
                )}
              </div>
            )}
            {isEmpty && !showCursor && (
              <div className="text-[12.5px] text-muted italic">(empty — click edit to add content)</div>
            )}
            {message.toolRequests && message.toolRequests.length > 0 && (
              <div className="mt-[10px] flex flex-col gap-[6px]">
                {message.toolRequests.map(tr => (
                  <div
                    key={tr.id}
                    className="rounded-md p-[10px]"
                    style={{
                      border: '1px solid color-mix(in srgb, var(--success) 25%, transparent)',
                      background: 'var(--success-subtle)',
                    }}
                  >
                    <div className="flex items-center gap-[8px] text-body-sm mono mb-[6px]">
                      <span className="inline-flex items-center px-[6px] py-[1px] rounded-full text-caption font-bold"
                        style={{ background: 'color-mix(in srgb, var(--success) 18%, transparent)', color: 'var(--success)' }}
                      >
                        tool call
                      </span>
                      <span className="font-bold" style={{ color: 'var(--success)' }}>{tr.name}</span>
                      <span className="text-muted text-[10px]">{tr.id.slice(0, 12)}</span>
                    </div>
                    <JsonBlock value={tr.arguments} hideCopy transparent maxHeight={180} className="!px-0 !py-0" />
                  </div>
                ))}
              </div>
            )}
            {message.toolError && (
              <div
                className="mt-[10px] text-[12px] mono px-[10px] py-[8px] rounded-[8px]"
                style={{
                  background: 'var(--danger-subtle)',
                  border: '1px solid color-mix(in srgb, var(--danger) 28%, transparent)',
                  color: 'var(--danger)',
                }}
              >
                {message.toolError}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function GripIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}
