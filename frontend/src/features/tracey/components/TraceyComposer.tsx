import { useMemo, useState, type KeyboardEvent } from 'react';
import { ComposerPrimitive, useComposer, useComposerRuntime } from '@assistant-ui/react';
import { QUICK_ACTIONS } from '../tracey-quick-actions';
import { TRACEY_TOOLS_META } from '../tracey-tools';
import { SlashMenu, type SlashItem } from './SlashMenu';
import { ToolChips } from './ToolChips';

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

export function TraceyComposer() {
  const composer = useComposerRuntime();
  const text = useComposer(c => c.text);
  const [rawIndex, setRawIndex] = useState(0);
  // The exact text the menu was dismissed at; typing anything else re-opens it (no effects needed).
  const [dismissedAt, setDismissedAt] = useState<string | null>(null);

  const open = text.startsWith('/') && text !== dismissedAt;
  const query = open ? text.slice(1).toLowerCase() : '';
  const items = useMemo(() => (open ? ALL_ITEMS.filter(i => matches(i, query)) : []), [open, query]);
  const activeIndex = items.length ? Math.min(Math.max(rawIndex, 0), items.length - 1) : 0;

  function selectItem(item: SlashItem) {
    // A quick-action fills its full prompt; a tool inserts a `/tool_name` slash command.
    const next = item.kind === 'action' ? item.action.prompt : `/${item.name} `;
    composer.setText(next);
    // Park the menu closed at exactly this text so it doesn't immediately re-open on a `/…` value.
    setDismissedAt(next);
    setRawIndex(0);
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
      setRawIndex((activeIndex + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setRawIndex((activeIndex - 1 + items.length) % items.length);
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
            onHover={setRawIndex}
          />
        )}
        <ComposerPrimitive.Root className="flex items-end gap-2 rounded-xl border border-border bg-card px-2.5 py-2">
          <ComposerPrimitive.Input
            autoFocus
            onKeyDown={onKeyDown}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={open ? 'tracey-slash-menu' : undefined}
            placeholder="Ask Tracey…  (/ for tools)"
            className="max-h-40 flex-1 resize-none bg-transparent px-1 py-1.5 text-[13px] text-primary outline-none placeholder:text-muted"
          />
          <ComposerPrimitive.Send className="btn-primary shrink-0 px-3.5 py-1.5 text-xs">
            Send
          </ComposerPrimitive.Send>
        </ComposerPrimitive.Root>
      </div>
    </div>
  );
}
