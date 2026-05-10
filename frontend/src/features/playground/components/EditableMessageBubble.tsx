import { useState } from 'react';
import {
  CopyIcon,
  EditIcon,
  PlayIcon,
  PlusIcon,
  TrashIcon,
} from '../../../components/icons';
import { JsonBlock } from '../../../components/ui/JsonBlock';
import { formInputCls } from '../../../components/ui/FormField';
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
    accent: '#22d3ee',
    bg: 'linear-gradient(180deg, rgba(34,211,238,0.07), rgba(34,211,238,0.03))',
    border: 'rgba(34,211,238,0.22)',
    label: 'User',
    badge: 'rgba(34,211,238,0.12)',
    icon: 'U',
  },
  assistant: {
    accent: '#a78bfa',
    bg: 'linear-gradient(180deg, rgba(167,139,250,0.07), rgba(167,139,250,0.03))',
    border: 'rgba(167,139,250,0.22)',
    label: 'Assistant',
    badge: 'rgba(167,139,250,0.12)',
    icon: 'A',
  },
  system: {
    accent: '#9ca3af',
    bg: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))',
    border: 'rgba(255,255,255,0.08)',
    label: 'System',
    badge: 'rgba(255,255,255,0.06)',
    icon: 'S',
  },
  tool: {
    accent: '#34d399',
    bg: 'linear-gradient(180deg, rgba(52,211,153,0.07), rgba(52,211,153,0.03))',
    border: 'rgba(52,211,153,0.22)',
    label: 'Tool',
    badge: 'rgba(52,211,153,0.12)',
    icon: 'T',
  },
};

interface Props {
  message: PlaygroundMessage;
  turnIndex: number;
  canReroll: boolean;
  isStreaming: boolean;
  onEdit: (content: string) => void;
  onDelete: () => void;
  onInsertAbove: () => void;
  onInsertBelow: () => void;
  onReroll: () => void;
}

export function EditableMessageBubble(props: Props) {
  const { message, turnIndex, canReroll, isStreaming, onEdit, onDelete, onInsertAbove, onInsertBelow, onReroll } = props;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const style = ROLE_STYLE[message.role];

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
      className="group rounded-[14px] overflow-hidden focus-within:outline focus-within:outline-1"
      style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
        boxShadow: 'var(--shadow-card)',
        outlineColor: style.border,
      }}
    >
      <div className="flex items-center gap-[8px] px-[12px] pt-[10px] pb-[8px]">
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
          <button type="button" className="btn-icon" title="Insert above" onClick={onInsertAbove} aria-label="Insert above">
            <PlusIcon size={12} strokeWidth={2.4} />
          </button>
          <button type="button" className="btn-icon" title="Insert below" onClick={onInsertBelow} aria-label="Insert below">
            <PlusIcon size={12} strokeWidth={2.4} />
          </button>
          <button type="button" className="btn-icon" title="Edit" onClick={beginEdit} aria-label="Edit">
            <EditIcon size={12} strokeWidth={2.2} />
          </button>
          <button type="button" className="btn-icon" title="Copy" onClick={copyContent} aria-label="Copy">
            <CopyIcon size={12} strokeWidth={2.2} />
          </button>
          {canReroll && (
            <button type="button" className="btn-icon" title="Re-roll from here" onClick={onReroll} aria-label="Re-roll">
              <PlayIcon size={12} strokeWidth={2.2} />
            </button>
          )}
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
                    className="rounded-[10px] p-[10px]"
                    style={{
                      border: '1px solid rgba(52,211,153,0.22)',
                      background: 'rgba(52,211,153,0.05)',
                    }}
                  >
                    <div className="flex items-center gap-[8px] text-[11.5px] mono mb-[6px]">
                      <span className="inline-flex items-center px-[6px] py-[1px] rounded-full text-[10px] font-bold"
                        style={{ background: 'rgba(52,211,153,0.18)', color: '#34d399' }}
                      >
                        tool call
                      </span>
                      <span className="font-bold" style={{ color: '#86efac' }}>{tr.name}</span>
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
                  border: '1px solid rgba(217,85,85,0.28)',
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
