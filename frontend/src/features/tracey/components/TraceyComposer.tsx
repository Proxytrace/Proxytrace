import { useMemo, useState, type KeyboardEvent } from 'react';
import { ComposerPrimitive, useComposer, useComposerRuntime } from '@assistant-ui/react';
import { QUICK_ACTIONS } from '../tracey-quick-actions';
import { TRACEY_TOOLS_META } from '../tracey-tools';
import { ArrowUpIcon, TrashIcon } from '../../../components/icons';
import { cn } from '../../../lib/cn';
import { SlashMenu, type SlashItem } from './SlashMenu';
import { ToolChips } from './ToolChips';

interface TraceyComposerProps {
  autoApprove: boolean;
  setAutoApprove: (value: boolean) => void;
  onClear: () => void;
}

const ALL_ITEMS: SlashItem[] = [
  ...QUICK_ACTIONS.map((action): SlashItem => ({ kind: 'action', action })),
  ...TRACEY_TOOLS_META.map((t): SlashItem => ({ kind: 'tool', name: t.name, description: t.description })),
];

function matches(item: SlashItem, query: string): boolean {
  if (!query) return true;
  const haystack =
    item.kind === 'action'
      ? `${item.action.label} ${item.action.hint}`
      : `${item.name} ${item.description}`;
  return haystack.toLowerCase().includes(query);
}

/** Pill-style toggle that gates write tools behind a confirmation prompt when off. */
function AutoApproveToggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="group flex cursor-pointer select-none items-center gap-2 rounded-full px-1 py-0.5 text-body-sm text-secondary transition-colors duration-[var(--motion-fast)] ease-[var(--ease-standard)] hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent-primary)_60%,transparent)]"
    >
      <span
        className={cn(
          'relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors duration-[var(--motion-base)] ease-[var(--ease-standard)]',
          checked ? 'bg-accent' : 'border border-border bg-card-2',
        )}
      >
        <span
          className={cn(
            'inline-block h-3 w-3 rounded-full bg-white transition-transform duration-[var(--motion-base)] ease-[var(--ease-standard)]',
            checked ? 'translate-x-3.5' : 'translate-x-0.5',
          )}
        />
      </span>
      Auto-approve actions
    </button>
  );
}

export function TraceyComposer({ autoApprove, setAutoApprove, onClear }: TraceyComposerProps) {
  const composer = useComposerRuntime();
  const text = useComposer(c => c.text);
  // The selection is tagged with the list ("key") it belongs to. When the menu (re)opens or the
  // query changes, that key changes and the highlight derives back to the first entry — so
  // keyboard nav always starts from a known position without an effect.
  const [sel, setSel] = useState<{ key: string; index: number }>({ key: '', index: 0 });
  // The exact text the menu was dismissed at; typing anything else re-opens it (no effects needed).
  const [dismissedAt, setDismissedAt] = useState<string | null>(null);

  const open = text.startsWith('/') && text !== dismissedAt;
  const query = open ? text.slice(1).toLowerCase() : '';
  const items = useMemo(() => (open ? ALL_ITEMS.filter(i => matches(i, query)) : []), [open, query]);
  const selKey = open ? query : '';
  const activeIndex = items.length
    ? (sel.key === selKey ? Math.min(Math.max(sel.index, 0), items.length - 1) : 0)
    : 0;
  const setActive = (index: number) => setSel({ key: selKey, index });

  function selectItem(item: SlashItem) {
    // A quick-action fills its full prompt; a tool inserts a `/tool_name` slash command.
    const next = item.kind === 'action' ? item.action.prompt : `/${item.name} `;
    composer.setText(next);
    // Park the menu closed at exactly this text so it doesn't immediately re-open on a `/…` value.
    setDismissedAt(next);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (!open || items.length === 0) {
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        setDismissedAt(text);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((activeIndex + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((activeIndex - 1 + items.length) % items.length);
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      selectItem(items[activeIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setDismissedAt(text);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
      <ToolChips />
      <div className="relative">
        {open && (
          <SlashMenu
            items={items}
            activeIndex={activeIndex}
            onSelect={selectItem}
            onHover={setActive}
          />
        )}
        <ComposerPrimitive.Root className="flex flex-col gap-2 rounded-xl border border-border bg-card px-3 py-2.5 shadow-[var(--shadow-card)] transition-colors duration-[var(--motion-base)] ease-[var(--ease-standard)] focus-within:border-[color-mix(in_srgb,var(--accent-primary)_40%,transparent)]">
          <ComposerPrimitive.Input
            autoFocus
            onKeyDown={onKeyDown}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={open ? 'tracey-slash-menu' : undefined}
            placeholder="Ask Tracey…  (/ for tools)"
            className="max-h-48 min-h-16 w-full resize-none bg-transparent px-1 pt-1 text-body text-primary outline-none placeholder:text-muted"
          />
          <div className="flex items-center justify-between gap-2">
            <AutoApproveToggle checked={autoApprove} onChange={setAutoApprove} />
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onClear}
                aria-label="Clear conversation"
                title="Clear conversation"
                className="btn-icon"
              >
                <TrashIcon size={16} />
              </button>
              <ComposerPrimitive.Send
                aria-label="Send"
                title="Send"
                className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-md bg-[image:var(--grad-accent)] text-white shadow-[var(--shadow-btn)] transition-[background,opacity] duration-[var(--motion-base)] ease-[var(--ease-standard)] hover:bg-[image:var(--grad-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent-primary)_60%,transparent)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowUpIcon size={16} />
              </ComposerPrimitive.Send>
            </div>
          </div>
        </ComposerPrimitive.Root>
      </div>
    </div>
  );
}
