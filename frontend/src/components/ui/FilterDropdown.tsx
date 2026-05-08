import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CheckIcon, ChevronDownIcon } from '../icons';

export interface FilterDropdownOption {
  key: string;
  label: string;
  accent?: string;
}

interface FilterDropdownProps {
  label: string;
  value: string;
  options: FilterDropdownOption[];
  onChange: (key: string) => void;
  active?: boolean;
  accent?: string;
  align?: 'left' | 'right';
  width?: number;
}

export function FilterDropdown({
  label,
  value,
  options,
  onChange,
  active,
  accent,
  align = 'left',
  width = 200,
}: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const close = useCallback(() => setOpen(false), []);

  const updatePosition = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const top = rect.bottom + 6;
    const left = align === 'right' ? rect.right - width : rect.left;
    setPos({ top, left });
  }, [align, width]);

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

  const selected = options.find(o => o.key === value);
  const displayLabel = selected?.label ?? value;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`inline-flex items-center gap-[6px] px-[10px] py-[6px] rounded-[8px] text-[12px] font-medium whitespace-nowrap cursor-pointer transition-colors duration-150 ${active ? 'bg-card-2 text-primary' : 'bg-card text-secondary hover:text-primary'}`}
        style={{ boxShadow: active ? '0 1px 0 rgba(255,255,255,0.06) inset, 0 1px 2px rgba(0,0,0,0.3)' : 'var(--shadow-pill)' }}
      >
        {accent && <span className="w-[7px] h-[7px] rounded-[2px] shrink-0" style={{ background: accent }} />}
        <span className="text-muted font-medium">{label}</span>
        <span>{displayLabel}</span>
        <ChevronDownIcon
          size={12}
          strokeWidth={2.5}
          className={`text-muted ml-[2px] transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && pos && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          className="fixed z-[60] bg-card-2 rounded-[10px] py-1 max-h-[280px] overflow-y-auto"
          style={{
            top: pos.top,
            left: pos.left,
            minWidth: width,
            boxShadow: '0 12px 32px -8px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)',
          }}
        >
          {options.map(opt => {
            const isSel = opt.key === value;
            return (
              <button
                key={opt.key}
                role="option"
                aria-selected={isSel}
                onClick={() => { onChange(opt.key); close(); }}
                className={`w-full flex items-center gap-2 px-[10px] py-[7px] text-[12.5px] text-left cursor-pointer transition-colors duration-100 hover:bg-[rgba(255,255,255,0.05)] ${isSel ? 'text-primary' : 'text-secondary'}`}
              >
                {opt.accent && <span className="w-[8px] h-[8px] rounded-[2px] shrink-0" style={{ background: opt.accent }} />}
                <span className="flex-1 truncate">{opt.label}</span>
                {isSel && <CheckIcon size={12} strokeWidth={2.5} className="text-accent-primary shrink-0" />}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}
