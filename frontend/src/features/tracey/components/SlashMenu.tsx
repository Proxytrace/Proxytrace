import { useEffect, useRef } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { cn } from '../../../lib/cn';
import { kbdCls } from '../../../components/ui/classes';
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

/**
 * The "/" picker: quick-actions ("skills") on top, raw tools below, a keyboard-hint footer
 * beneath. Anchored above the composer. Only the option list is the ARIA listbox — the footer
 * sits outside it so assistive tech never counts the hints as an option.
 */
export function SlashMenu({ items, activeIndex, onSelect, onHover }: SlashMenuProps) {
  const { t, i18n } = useLingui();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    // eslint-disable-next-line lingui/no-unlocalized-strings -- scrollIntoView option token, not UI copy
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (items.length === 0) return null;

  const firstToolIndex = items.findIndex(i => i.kind === 'tool');

  return (
    <div className="fade-up absolute bottom-full left-0 right-0 mb-2 flex flex-col overflow-hidden rounded-lg border border-border bg-surface-2 shadow-[var(--shadow-float)]">
      <div
        ref={listRef}
        id="tracey-slash-menu"
        role="listbox"
        aria-label={t`Tracey quick actions and tools`}
        className="max-h-64 overflow-y-auto py-1"
      >
        {items.map((item, index) => {
          const active = index === activeIndex;
          const label = item.kind === 'action' ? i18n._(item.action.label) : item.name;
          const hint = item.kind === 'action' ? i18n._(item.action.hint) : item.description;
          return (
            <div key={item.kind === 'action' ? item.action.id : item.name} role="presentation">
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
                className={cn(
                  'flex w-full items-baseline gap-2 border-l-2 px-3 py-1.5 text-left transition-colors cursor-pointer',
                  active
                    ? 'border-accent bg-[color-mix(in_srgb,var(--accent-primary)_30%,transparent)]'
                    : 'border-transparent bg-transparent hover:bg-[var(--bg-wash-hover)]',
                )}
              >
                <span
                  className={cn(
                    'shrink-0 text-title',
                    item.kind === 'tool' ? 'font-mono text-accent' : 'font-medium text-primary',
                  )}
                >
                  {label}
                </span>
                <span className="min-w-0 truncate text-body-sm text-muted">{hint}</span>
              </button>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 border-t border-hairline px-3 py-1.5 text-caption text-muted">
        <span className="inline-flex items-center gap-1">
          <kbd className={kbdCls}>↑↓</kbd> <Trans>navigate</Trans>
        </span>
        <span className="inline-flex items-center gap-1">
          <kbd className={kbdCls}>↵</kbd> <Trans>select</Trans>
        </span>
        <span className="inline-flex items-center gap-1">
          {/* eslint-disable-next-line lingui/no-unlocalized-strings -- key name, not UI copy */}
          <kbd className={kbdCls}>esc</kbd> <Trans>dismiss</Trans>
        </span>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div role="presentation" className="px-3 pb-1 pt-1.5 text-caption font-semibold uppercase tracking-[0.08em] text-muted">
      {children}
    </div>
  );
}
