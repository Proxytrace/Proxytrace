import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Trans, useLingui } from '@lingui/react/macro';
import { msg } from '@lingui/core/macro';
import type { MessageDescriptor } from '@lingui/core';
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

const ROLE_OPTIONS: { value: PlaygroundRole; label: MessageDescriptor; accent: string; description: MessageDescriptor }[] = [
  { value: 'user', label: msg`User`, accent: 'var(--teal)', description: msg`Message from the human` },
  { value: 'assistant', label: msg`Assistant`, accent: 'var(--accent-hover)', description: msg`Reply from the model` },
  { value: 'system', label: msg`System`, accent: 'var(--text-secondary)', description: msg`System instruction` },
];

export function AddMessageBar({ onAdd, onLoadFromTrace }: Props) {
  const { i18n } = useLingui();
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
    <div className="mt-0.5">
      <Button
        ref={buttonRef}
        variant="ghost"
        fullWidth
        data-testid="add-message-bar"
        className={cn(
          'group py-2.5 rounded-md border border-dashed',
          open
            ? 'bg-accent-subtle border-[color-mix(in_srgb,var(--accent-primary)_32%,transparent)] text-accent-hover'
            : 'border-border text-muted',
        )}
        leftIcon={<PlusIcon size={13} strokeWidth={2.4} />}
        // eslint-disable-next-line lingui/no-unlocalized-strings -- ARIA role token, not UI copy
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-body-sm font-semibold uppercase tracking-[0.08em]"><Trans>Add message</Trans></span>
      </Button>
      {open && pos && createPortal(
        <div
          ref={menuRef}
          role="menu"
          className="fixed z-[60] -translate-x-1/2 rounded-lg py-1.5 fade-up bg-surface-2 border border-border shadow-[var(--shadow-float)]"
          style={{ bottom: pos.bottom, left: pos.left, width: MENU_WIDTH }}
        >
          <div className="px-2.5 pt-0.5 pb-1.5 text-caption font-semibold uppercase tracking-[0.08em] text-muted">
            <Trans>New message role</Trans>
          </div>
          {ROLE_OPTIONS.map(opt => {
            const label = i18n._(opt.label);
            return (
            <RowButton
              key={opt.value}
              role="menuitem"
              onClick={() => { onAdd(opt.value); close(); }}
              data-testid={`add-message-role-${opt.value}`}
              className="flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-card transition-colors"
            >
              <span
                aria-hidden
                className="inline-flex items-center justify-center size-[24px] rounded-full text-body-sm font-bold shrink-0 bg-[var(--bg-wash-hover)]"
                style={{
                  color: opt.accent,
                  border: `1px solid color-mix(in srgb, ${opt.accent} 22%, transparent)`,
                }}
              >
                {label[0]}
              </span>
              <span className="flex flex-col min-w-0">
                <span className="text-body text-primary font-semibold">{label}</span>
                <span className="text-caption text-muted">{i18n._(opt.description)}</span>
              </span>
            </RowButton>
            );
          })}
          {onLoadFromTrace && (
            <>
              <div className="my-1 mx-2.5 border-t border-border" />
              <RowButton
                role="menuitem"
                onClick={() => { onLoadFromTrace(); close(); }}
                className="flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-card transition-colors"
              >
                <span
                  aria-hidden
                  className="inline-flex items-center justify-center size-[24px] rounded-full shrink-0 bg-[var(--bg-wash-hover)] text-secondary border border-border"
                >
                  <SearchIcon size={12} strokeWidth={2.2} />
                </span>
                <span className="flex flex-col min-w-0">
                  <span className="text-body text-primary font-semibold"><Trans>Load from trace</Trans></span>
                  <span className="text-caption text-muted"><Trans>Seed conversation from past trace or test case</Trans></span>
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
