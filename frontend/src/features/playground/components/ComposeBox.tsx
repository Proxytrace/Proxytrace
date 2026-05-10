import { useState } from 'react';
import { formInputCls } from '../../../components/ui/FormField';

interface Props {
  disabled: boolean;
  onSend: (text: string) => void;
}

export function ComposeBox({ disabled, onSend }: Props) {
  const [text, setText] = useState('');

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  };

  return (
    <div className="border-t border-border p-[12px] flex items-end gap-2">
      <textarea
        className={`${formInputCls} resize-y flex-1`}
        rows={3}
        placeholder="Send a user message… (⌘/Ctrl + Enter to send)"
        value={text}
        disabled={disabled}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); send(); }
        }}
      />
      <button
        className="btn-primary shrink-0"
        onClick={send}
        disabled={disabled || !text.trim()}
      >
        Send
      </button>
    </div>
  );
}
