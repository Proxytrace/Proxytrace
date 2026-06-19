import { useEffect, useRef } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import type { QuickAction } from '../tracey-quick-actions';

export type SlashItem =
  | { kind: 'action'; action: QuickAction }
  | { kind: 'tool'; name: string; description: string };

interface SlashMenuProps {
  items: SlashItem[];
  activeIndex: number;
  onSelect: (item: SlashItem) => void;
  onHover: (index: number) => void;
}

/** The "/" picker: quick-actions ("skills") on top, raw tools below. Anchored above the composer. */
export function SlashMenu({ items, activeIndex, onSelect, onHover }: SlashMenuProps) {
  const { t } = useLingui();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    // eslint-disable-next-line lingui/no-unlocalized-strings -- scrollIntoView option token, not UI copy
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (items.length === 0) return null;

  const firstToolIndex = items.findIndex(i => i.kind === 'tool');

  return (
    <div
      ref={listRef}
      id="tracey-slash-menu"
      role="listbox"
      aria-label={t`Tracey quick actions and tools`}
      className="absolute bottom-full left-0 right-0 mb-2 max-h-72 overflow-y-auto rounded-lg border border-border bg-surface-2 py-1 shadow-[var(--shadow-float)]"
    >
      {items.map((item, index) => {
        const active = index === activeIndex;
        const label = item.kind === 'action' ? item.action.label : item.name;
        const hint = item.kind === 'action' ? item.action.hint : item.description;
        return (
          <div key={item.kind === 'action' ? item.action.id : item.name}>
            {index === 0 && item.kind === 'action' && <SectionLabel><Trans>Quick actions</Trans></SectionLabel>}
            {index === firstToolIndex && firstToolIndex >= 0 && <SectionLabel><Trans>Tools</Trans></SectionLabel>}
            {/* eslint-disable-next-line no-restricted-syntax -- composer slash-menu option; focus/keyboard coupled to the composer (see TRACEY.md) */}
            <button
              type="button"
              role="option"
              aria-selected={active}
              data-index={index}
              onMouseEnter={() => onHover(index)}
              onMouseDown={e => {
                // Keep composer focus; fire on mousedown so the click lands before blur.
                e.preventDefault();
                onSelect(item);
              }}
              className={`flex w-full items-baseline gap-2 border-l-2 px-3 py-1.5 text-left transition-colors cursor-pointer ${
                active
                  ? 'border-accent bg-[color-mix(in_srgb,var(--accent-primary)_30%,transparent)]'
                  : 'border-transparent bg-transparent hover:bg-[var(--bg-wash-hover)]'
              }`}
            >
              <span
                className={`shrink-0 text-[13px] ${
                  item.kind === 'tool' ? 'font-mono text-accent' : 'font-medium text-primary'
                }`}
              >
                {label}
              </span>
              <span className="truncate text-[11px] text-muted">{hint}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
      {children}
    </div>
  );
}
