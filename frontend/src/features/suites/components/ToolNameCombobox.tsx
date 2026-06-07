import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ToolSpecDto } from '../../../api/models';
import { Input } from '../../../components/ui/Input';
import { RowButton } from '../../../components/ui/RowButton';
import { ChevronDownIcon } from '../../../components/icons';
import { cn } from '../../../lib/cn';

interface Props {
  value: string;
  tools: ToolSpecDto[];
  invalid?: boolean;
  /** Free-text typing. */
  onChange: (name: string) => void;
  /** Picking a declared tool from the list (used to also seed its argument skeleton). */
  onPickTool: (tool: ToolSpecDto) => void;
}

/**
 * Tool-name field: a free-text input fronting a dropdown of the agent's declared tools.
 * Picking one fills the name and lets the caller seed its argument skeleton.
 */
export function ToolNameCombobox({ value, tools, invalid, onChange, onPickTool }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const close = useCallback(() => setOpen(false), []);

  const updatePosition = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  }, []);

  useLayoutEffect(() => {
    if (open) updatePosition();
  }, [open, updatePosition]);

  // Genuine external subscriptions (outside-click / scroll reposition) — acceptable per §4.1.
  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      close();
    };
    const onReflow = () => updatePosition();
    document.addEventListener('mousedown', onDocDown);
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    };
  }, [open, close, updatePosition]);

  const q = value.trim().toLowerCase();
  const matches = q ? tools.filter(t => t.name.toLowerCase().includes(q)) : tools;

  return (
    <div ref={wrapRef} className="relative flex-1 min-w-0">
      <Input
        inputSize="sm"
        aria-label="Tool name"
        role="combobox"
        aria-expanded={open}
        placeholder="Choose a tool or type a name…"
        className="pr-7"
        invalid={value.trim().length === 0 || invalid}
        value={value}
        onChange={e => { onChange(e.target.value); if (!open) setOpen(true); }}
        onFocus={() => setOpen(true)}
      />
      {/* eslint-disable-next-line no-restricted-syntax -- inline chevron affordance positioned inside the field (tabIndex -1) */}
      <button
        type="button"
        tabIndex={-1}
        aria-label={open ? 'Hide tools' : 'Show available tools'}
        onClick={() => setOpen(o => !o)}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-primary cursor-pointer transition-colors"
      >
        <ChevronDownIcon
          size={13}
          strokeWidth={2.5}
          className={cn('transition-transform duration-150', open && 'rotate-180')}
        />
      </button>

      {open && pos && tools.length > 0 && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          className="fixed z-[120] bg-card-2 rounded-[10px] py-1 max-h-[240px] overflow-y-auto shadow-[0_12px_32px_-8px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.06)]"
          style={{ top: pos.top, left: pos.left, minWidth: pos.width }}
        >
          {matches.length === 0 ? (
            <div className="px-[10px] py-2 text-[12px] text-muted">No matching tools — keep typing for a custom name.</div>
          ) : (
            matches.map(tool => (
              <RowButton
                key={tool.name}
                role="option"
                aria-selected={tool.name === value}
                onClick={() => { onPickTool(tool); close(); }}
                className="flex flex-col items-start gap-[1px] px-[10px] py-[7px] transition-colors duration-100 hover:bg-[rgba(255,255,255,0.05)]"
              >
                <span className="mono text-[12.5px] text-primary truncate max-w-full">{tool.name}</span>
                <span className="text-[10.5px] text-muted truncate max-w-full">
                  {tool.arguments.length} param{tool.arguments.length !== 1 ? 's' : ''}
                  {tool.description ? ` · ${tool.description}` : ''}
                </span>
              </RowButton>
            ))
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
