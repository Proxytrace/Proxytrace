import { EditableMessageBubble } from './EditableMessageBubble';
import type { PlaygroundMessage, PlaygroundRole } from '../state/types';

interface Props {
  messages: PlaygroundMessage[];
  onEdit: (localId: string, content: string) => void;
  onDelete: (localId: string) => void;
  onInsert: (atIndex: number, role: PlaygroundRole) => void;
  onReroll: (localId: string) => void;
}

export function ConversationView({ messages, onEdit, onDelete, onInsert, onReroll }: Props) {
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted text-[13px]">
        No messages. Type below to start, or load a conversation from search.
      </div>
    );
  }
  return (
    <div className="flex-1 overflow-y-auto px-[14px] py-[12px] flex flex-col gap-[10px]">
      {messages.map((m, i) => (
        <EditableMessageBubble
          key={m.localId}
          message={m}
          canReroll={m.role === 'user' || m.role === 'system'}
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
