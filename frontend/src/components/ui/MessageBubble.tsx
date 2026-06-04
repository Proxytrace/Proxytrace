import { useState } from 'react';
import { ChevronRightIcon } from '../icons';
import { CopyButton } from './CopyButton';
import { hoverRevealOverlayCls } from './classes';
import { cn } from '../../lib/cn';

type RoleKey = 'user' | 'assistant' | 'system';

interface RoleStyle {
  accentText: string;
  accentBg: string;
  bodyBg: string;
  border: string;
  hover: string;
  label: string;
}

const ROLES: Record<RoleKey, RoleStyle> = {
  user: {
    accentText: 'text-[var(--teal)]',
    accentBg: 'bg-[var(--teal)]',
    bodyBg: 'bg-[color-mix(in_srgb,var(--teal)_6%,transparent)]',
    border: 'border-[color-mix(in_srgb,var(--teal)_25%,transparent)]',
    hover: 'hover:bg-[color-mix(in_srgb,var(--teal)_5%,transparent)]',
    label: 'USER',
  },
  assistant: {
    accentText: 'text-[var(--accent-primary)]',
    accentBg: 'bg-[var(--accent-primary)]',
    bodyBg: 'bg-[var(--accent-subtle)]',
    border: 'border-[color-mix(in_srgb,var(--accent-primary)_25%,transparent)]',
    hover: 'hover:bg-[color-mix(in_srgb,var(--accent-primary)_5%,transparent)]',
    label: 'ASSISTANT',
  },
  system: {
    accentText: 'text-[var(--text-secondary)]',
    accentBg: 'bg-[var(--text-secondary)]',
    bodyBg: 'bg-[var(--bg-wash-hover)]',
    border: 'border-[var(--border-color)]',
    hover: 'hover:bg-[var(--bg-wash-hover)]',
    label: 'SYSTEM',
  },
};

function roleKey(role: string): RoleKey {
  return role === 'user' || role === 'system' ? role : 'assistant';
}

interface Props {
  msg: { role: string; content: string };
  defaultOpen?: boolean;
  /** Overrides the role-derived header label (e.g. "Expected"). */
  label?: string;
}

export function MessageBubble({ msg, defaultOpen = true, label }: Props) {
  const role = ROLES[roleKey(msg.role)];
  const [open, setOpen] = useState(defaultOpen);

  const content = msg.content?.trim() ?? '';
  if (!content) return null;

  const oneLine = content.replace(/\s+/g, ' ');
  const preview = oneLine.length > 90 ? oneLine.slice(0, 90) + '…' : oneLine;
  const charCount = content.length;
  const isSystem = msg.role === 'system';

  return (
    <div
      className={cn('relative group rounded-[12px] overflow-hidden bg-card-2 border shadow-[0_1px_0_rgba(255,255,255,0.03)_inset]', role.border)}
    >
      <CopyButton text={content} label="Copy message" className={hoverRevealOverlayCls} />
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className={cn('w-full flex items-center gap-2 pl-3 pr-9 py-[10px] text-left bg-transparent border-0 cursor-pointer transition-colors duration-100', role.hover)}
      >
        <span
          aria-hidden
          className={cn('inline-flex shrink-0 transition-transform duration-150', role.accentText, open && 'rotate-90')}
        >
          <ChevronRightIcon size={11} strokeWidth={2.5} />
        </span>
        <span aria-hidden className={cn('w-[5px] h-[5px] rounded-full shrink-0', role.accentBg)} />
        <span className={cn('font-mono text-[10.5px] font-bold tracking-[0.08em] shrink-0', role.accentText)}>
          {label ?? role.label}
        </span>
        {!open && (
          <span className="text-[12px] truncate min-w-0 text-secondary">
            {preview}
          </span>
        )}
        <span className="ml-auto font-mono text-[9.5px] tracking-[0.06em] shrink-0 text-muted">
          {charCount.toLocaleString()} chars
        </span>
      </button>

      {open && (
        <div className="border-t border-t-[rgba(255,255,255,0.05)]">
          <div className={cn('px-[14px] py-[12px]', role.bodyBg)}>
            <div className={`text-[13px] leading-[1.65] whitespace-pre-wrap ${isSystem ? 'text-secondary italic' : 'text-primary'}`}>
              {content}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
