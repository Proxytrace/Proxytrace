import { useEffect, useRef, useState } from 'react';
import { PlusIcon } from '../../../components/icons';
import type { PlaygroundRole } from '../state/types';

interface Props {
  onAdd: (role: PlaygroundRole) => void;
}

const ROLE_OPTIONS: { value: PlaygroundRole; label: string; accent: string; description: string }[] = [
  { value: 'user', label: 'User', accent: 'var(--teal)', description: 'Message from the human' },
  { value: 'assistant', label: 'Assistant', accent: 'var(--accent-hover)', description: 'Reply from the model' },
  { value: 'system', label: 'System', accent: 'var(--text-secondary)', description: 'System instruction' },
];

export function AddMessageBar({ onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative mt-[2px]">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="group w-full flex items-center justify-center gap-[8px] py-[10px] rounded-[10px] cursor-pointer transition-colors"
        style={{
          background: open ? 'var(--accent-subtle)' : 'transparent',
          border: `1px dashed ${open ? 'rgba(201,148,74,0.32)' : 'var(--border-color)'}`,
          color: open ? 'var(--accent-hover)' : 'var(--text-muted)',
        }}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <PlusIcon size={13} strokeWidth={2.4} />
        <span className="text-[11.5px] font-semibold uppercase tracking-[0.08em]">Add message</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-1/2 -translate-x-1/2 bottom-full mb-[6px] z-30 w-[260px] rounded-[12px] py-[6px] fade-up"
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-float)',
          }}
        >
          <div className="px-[10px] pt-[2px] pb-[6px] text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
            New message role
          </div>
          {ROLE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              role="menuitem"
              onClick={() => { onAdd(opt.value); setOpen(false); }}
              className="w-full flex items-center gap-[10px] px-[10px] py-[7px] text-left cursor-pointer hover:bg-card transition-colors"
            >
              <span
                aria-hidden
                className="inline-flex items-center justify-center size-[24px] rounded-full text-[11px] font-bold shrink-0"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  color: opt.accent,
                  border: `1px solid color-mix(in srgb, ${opt.accent} 22%, transparent)`,
                }}
              >
                {opt.label[0]}
              </span>
              <span className="flex flex-col min-w-0">
                <span className="text-[12.5px] text-primary font-semibold">{opt.label}</span>
                <span className="text-[10.5px] text-muted">{opt.description}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
