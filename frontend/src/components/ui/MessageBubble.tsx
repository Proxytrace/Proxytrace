import { useState } from 'react';
import type { MessageDto } from '../../api/models';
import { ChevronRightIcon } from '../icons';

interface RoleStyle {
  accent: string;
  bodyBg: string;
  border: string;
  hover: string;
  label: string;
}

const ROLES: Record<string, RoleStyle> = {
  user: {
    accent: '#06b6d4',
    bodyBg: 'rgba(6,182,212,0.05)',
    border: 'rgba(6,182,212,0.22)',
    hover: 'rgba(6,182,212,0.04)',
    label: 'USER',
  },
  assistant: {
    accent: '#8b5cf6',
    bodyBg: 'rgba(139,92,246,0.05)',
    border: 'rgba(139,92,246,0.22)',
    hover: 'rgba(139,92,246,0.04)',
    label: 'ASSISTANT',
  },
  system: {
    accent: '#a1a1aa',
    bodyBg: 'rgba(107,107,117,0.05)',
    border: 'rgba(255,255,255,0.07)',
    hover: 'rgba(255,255,255,0.025)',
    label: 'SYSTEM',
  },
};

interface Props {
  msg: MessageDto;
  defaultOpen?: boolean;
}

export function MessageBubble({ msg, defaultOpen = true }: Props) {
  const role = ROLES[msg.role] ?? ROLES.assistant;
  const [open, setOpen] = useState(defaultOpen);
  const [hover, setHover] = useState(false);

  const content = msg.content?.trim() ?? '';
  if (!content) return null;

  const oneLine = content.replace(/\s+/g, ' ');
  const preview = oneLine.length > 90 ? oneLine.slice(0, 90) + '…' : oneLine;
  const charCount = content.length;
  const isSystem = msg.role === 'system';

  return (
    <div
      className="rounded-[12px] overflow-hidden bg-card-2"
      style={{ border: `1px solid ${role.border}`, boxShadow: '0 1px 0 rgba(255,255,255,0.03) inset' }}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className="w-full flex items-center gap-2 px-3 py-[10px] text-left bg-transparent border-0 cursor-pointer transition-colors duration-100"
        style={{ background: hover ? role.hover : 'transparent' }}
      >
        <span
          aria-hidden
          className={`inline-flex shrink-0 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
          style={{ color: role.accent }}
        >
          <ChevronRightIcon size={11} strokeWidth={2.5} />
        </span>
        <span aria-hidden className="w-[5px] h-[5px] rounded-full shrink-0" style={{ background: role.accent }} />
        <span className="font-mono text-[10.5px] font-bold tracking-[0.08em] shrink-0" style={{ color: role.accent }}>
          {role.label}
        </span>
        {!open && (
          <span className="text-[12px] truncate min-w-0 text-secondary">
            {preview}
          </span>
        )}
        <span className="ml-auto font-mono text-[9.5px] tracking-[0.06em] shrink-0" style={{ color: '#52525b' }}>
          {charCount.toLocaleString()} chars
        </span>
      </button>

      {open && (
        <div className="border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <div className="px-[14px] py-[12px]" style={{ background: role.bodyBg }}>
            <div className={`text-[13px] leading-[1.65] whitespace-pre-wrap ${isSystem ? 'text-secondary italic' : 'text-primary'}`}>
              {content}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
