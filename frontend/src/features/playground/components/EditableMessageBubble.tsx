import { useState } from 'react';
import { ChevronRightIcon, EditIcon, PlayIcon, PlusIcon, TrashIcon } from '../../../components/icons';
import { JsonBlock } from '../../../components/ui/JsonBlock';
import { formInputCls } from '../../../components/ui/FormField';
import type { PlaygroundMessage, PlaygroundRole } from '../state/types';

const ROLE_STYLE: Record<PlaygroundRole, { accent: string; bg: string; border: string; label: string }> = {
  user: { accent: '#06b6d4', bg: 'rgba(6,182,212,0.05)', border: 'rgba(6,182,212,0.22)', label: 'USER' },
  assistant: { accent: '#8b5cf6', bg: 'rgba(139,92,246,0.05)', border: 'rgba(139,92,246,0.22)', label: 'ASSISTANT' },
  system: { accent: '#a1a1aa', bg: 'rgba(107,107,117,0.05)', border: 'rgba(255,255,255,0.07)', label: 'SYSTEM' },
  tool: { accent: '#10b981', bg: 'rgba(16,185,129,0.05)', border: 'rgba(16,185,129,0.22)', label: 'TOOL' },
};

interface Props {
  message: PlaygroundMessage;
  canReroll: boolean;
  onEdit: (content: string) => void;
  onDelete: () => void;
  onInsertAbove: () => void;
  onInsertBelow: () => void;
  onReroll: () => void;
}

export function EditableMessageBubble(props: Props) {
  const { message, canReroll, onEdit, onDelete, onInsertAbove, onInsertBelow, onReroll } = props;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [open, setOpen] = useState(true);
  const style = ROLE_STYLE[message.role];

  const beginEdit = () => { setDraft(message.content); setEditing(true); };
  const saveEdit = () => { onEdit(draft); setEditing(false); };

  return (
    <div
      className="rounded-[12px] overflow-hidden bg-card-2 group"
      style={{ border: `1px solid ${style.border}` }}
    >
      <div className="flex items-center gap-2 px-3 py-[8px]">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className={`inline-flex shrink-0 transition-transform duration-150 ${open ? 'rotate-90' : ''} bg-transparent border-0 cursor-pointer`}
          style={{ color: style.accent }}
        >
          <ChevronRightIcon size={11} strokeWidth={2.5} />
        </button>
        <span className="font-mono text-[10.5px] font-bold tracking-[0.08em]" style={{ color: style.accent }}>
          {style.label}
        </span>
        {message.toolCallId && (
          <span className="font-mono text-[10px] text-muted">tool_call_id: {message.toolCallId.slice(0, 12)}</span>
        )}
        {message.errored && (
          <span className="font-mono text-[10px] text-danger">error</span>
        )}
        <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button type="button" className="btn-icon" title="Insert above" onClick={onInsertAbove}>
            <PlusIcon size={12} />
          </button>
          <button type="button" className="btn-icon" title="Insert below" onClick={onInsertBelow}>
            <PlusIcon size={12} />
          </button>
          <button type="button" className="btn-icon" title="Edit" onClick={beginEdit}>
            <EditIcon size={12} />
          </button>
          {canReroll && (
            <button type="button" className="btn-icon" title="Re-roll from here" onClick={onReroll}>
              <PlayIcon size={12} />
            </button>
          )}
          <button type="button" className="btn-icon" title="Delete" onClick={onDelete}>
            <TrashIcon size={12} />
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-[rgba(255,255,255,0.05)]">
          <div className="px-[14px] py-[12px]" style={{ background: style.bg }}>
            {editing ? (
              <div className="flex flex-col gap-[8px]">
                <textarea
                  className={`${formInputCls} resize-y font-mono text-[12.5px]`}
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
                {message.content && (
                  <div className="text-[13px] leading-[1.65] whitespace-pre-wrap text-primary">
                    {message.content || <span className="text-muted italic">(empty)</span>}
                  </div>
                )}
                {message.toolRequests && message.toolRequests.length > 0 && (
                  <div className="mt-[8px] flex flex-col gap-[6px]">
                    {message.toolRequests.map(tr => (
                      <div key={tr.id} className="rounded-[8px] border border-[rgba(16,185,129,0.18)] bg-[rgba(16,185,129,0.05)] p-[8px]">
                        <div className="flex items-center gap-2 text-[11.5px] font-mono mb-[4px]">
                          <span className="font-bold text-emerald-300">{tr.name}</span>
                          <span className="text-muted text-[10px]">{tr.id.slice(0, 12)}</span>
                        </div>
                        <JsonBlock value={tr.arguments} hideCopy transparent maxHeight={160} className="!px-0 !py-0" />
                      </div>
                    ))}
                  </div>
                )}
                {message.toolError && (
                  <div className="mt-[8px] text-[11.5px] text-danger font-mono">Error: {message.toolError}</div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
