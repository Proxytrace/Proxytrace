import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PlusIcon, SearchIcon } from '../../../components/icons';
import { Button } from '../../../components/ui/Button';
import { RowButton } from '../../../components/ui/RowButton';
import { cn } from '../../../lib/cn';
import type { PlaygroundRole } from '../state/types';

interface Props {
  onAdd: (role: PlaygroundRole) => void;
  onLoadFromTrace?: () => void;
}

const MENU_WIDTH = 260;

const ROLE_OPTIONS: { value: PlaygroundRole; label: string; accent: string; description: string }[] = [
  { value: 'user', label: 'User', accent: 'var(--teal)', description: 'Message from the human' },
  { value: 'assistant', label: 'Assistant', accent: 'var(--accent-hover)', description: 'Reply from the model' },
  { value: 'system', label: 'System', accent: 'var(--text-secondary)', description: 'System instruction' },
];

export function AddMessageBar({ onAdd, onLoadFromTrace }: Props) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  // The menu opens upward; anchor its bottom edge just above the button so it is never
  // clipped by the conversation list's `overflow-y-auto` container (it lives in a portal).
  const [pos, setPos] = useState<{ bottom: number; left: number } | null>(null);

  const close = useCallback(() => setOpen(false), []);

  const updatePosition = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    setPos({ bottom: window.innerHeight - rect.top + 6, left: rect.left + rect.width / 2 });
  }, []);

  useLayoutEffect(() => {
    if (open) updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    const onScrollOrResize = () => updatePosition();
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [open, close, updatePosition]);

  return (
    <div className="mt-[2px]">
      <Button
        ref={buttonRef}
        variant="ghost"
        fullWidth
        data-testid="add-message-bar"
        className={cn(
          'group py-[10px] rounded-[10px] border border-dashed',
          open
            ? 'bg-accent-subtle border-[color-mix(in_srgb,var(--accent-primary)_32%,transparent)] text-accent-hover'
            : 'border-border text-muted',
        )}
        leftIcon={<PlusIcon size={13} strokeWidth={2.4} />}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-[11.5px] font-semibold uppercase tracking-[0.08em]">Add message</span>
      </Button>
      {open && pos && createPortal(
        <div
          ref={menuRef}
          role="menu"
          className="fixed z-[60] -translate-x-1/2 rounded-[12px] py-[6px] fade-up bg-surface-2 border border-border shadow-[var(--shadow-float)]"
          style={{ bottom: pos.bottom, left: pos.left, width: MENU_WIDTH }}
        >
          <div className="px-[10px] pt-[2px] pb-[6px] text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
            New message role
          </div>
          {ROLE_OPTIONS.map(opt => (
            <RowButton
              key={opt.value}
              role="menuitem"
              onClick={() => { onAdd(opt.value); close(); }}
              data-testid={`add-message-role-${opt.value}`}
              className="flex items-center gap-[10px] px-[10px] py-[7px] hover:bg-card transition-colors"
            >
              <span
                aria-hidden
                className="inline-flex items-center justify-center size-[24px] rounded-full text-[11px] font-bold shrink-0 bg-[rgba(255,255,255,0.04)]"
                style={{
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
            </RowButton>
          ))}
          {onLoadFromTrace && (
            <>
              <div className="my-[4px] mx-[10px] border-t border-border" />
              <RowButton
                role="menuitem"
                onClick={() => { onLoadFromTrace(); close(); }}
                className="flex items-center gap-[10px] px-[10px] py-[7px] hover:bg-card transition-colors"
              >
                <span
                  aria-hidden
                  className="inline-flex items-center justify-center size-[24px] rounded-full shrink-0 bg-[rgba(255,255,255,0.04)] text-secondary border border-border"
                >
                  <SearchIcon size={12} strokeWidth={2.2} />
                </span>
                <span className="flex flex-col min-w-0">
                  <span className="text-[12.5px] text-primary font-semibold">Load from trace</span>
                  <span className="text-[10.5px] text-muted">Seed conversation from past trace or test case</span>
                </span>
              </RowButton>
            </>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
