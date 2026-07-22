import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Trans, useLingui } from '@lingui/react/macro';
import { cn } from '../../lib/cn';
import { Input } from './Input';
import { CheckIcon, ChevronDownIcon, SearchIcon } from '../icons';
import { formInputCls } from './classes';

interface MultiComboboxProps<T> {
  /** Currently selected item keys. */
  values: string[];
  /** Called with the full next selection whenever an item is toggled. */
  onChange: (values: string[]) => void;
  items: T[];
  itemKey: (item: T) => string;
  itemLabel: (item: T) => string;
  /** Right-aligned secondary text on each option row (e.g. provider name). */
  itemMeta?: (item: T) => ReactNode;
  /** Runtime accent hex for an item (e.g. modelColor) — colors its chip + check box. */
  itemColor?: (item: T) => string;
  /** Hard cap: once reached, unselected options are disabled and a hint is shown. */
  maxSelected?: number;
  placeholder?: string;
  searchPlaceholder?: string;
  /** Shown inside the dropdown when there are no items at all. */
  emptyText?: string;
  invalid?: boolean;
  disabled?: boolean;
  inputSize?: 'sm' | 'md';
  'aria-label'?: string;
  'data-testid'?: string;
}

/**
 * Searchable multi-select (Radix Popover-backed). The trigger shows the selected items as
 * colored chips; opening reveals a search box + a toggleable, checkbox-style option list that
 * stays open across selections. Pass `maxSelected` to cap the selection — excess options are
 * disabled with a live hint. For single choice use {@link Combobox}; for a short static list use
 * the native `Select`.
 */
export function MultiCombobox<T>({
  values,
  onChange,
  items,
  itemKey,
  itemLabel,
  itemMeta,
  itemColor,
  maxSelected,
  placeholder,
  searchPlaceholder,
  emptyText,
  invalid,
  disabled,
  // eslint-disable-next-line lingui/no-unlocalized-strings -- size variant token, not UI copy
  inputSize = 'md',
  'aria-label': ariaLabel,
  'data-testid': testId,
}: MultiComboboxProps<T>) {
  const { t } = useLingui();
  const placeholderText = placeholder ?? t`Select…`;
  const searchPlaceholderText = searchPlaceholder ?? t`Search…`;
  const emptyTextResolved = emptyText ?? t`No options available.`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedSet = useMemo(() => new Set(values), [values]);
  const selectedItems = useMemo(
    () => items.filter(i => selectedSet.has(itemKey(i))),
    [items, selectedSet, itemKey],
  );
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter(i => itemLabel(i).toLowerCase().includes(q)) : items;
  }, [items, query, itemLabel]);

  const limitReached = maxSelected != null && values.length >= maxSelected;

  const toggle = (item: T) => {
    const key = itemKey(item);
    if (selectedSet.has(key)) onChange(values.filter(v => v !== key));
    else if (!limitReached) onChange([...values, key]);
  };

  const sizeCls = inputSize === 'sm' ? cn('px-2 py-1 text-body-sm') : cn('px-2.5 py-1.5 text-title');

  return (
    <Popover.Root
      open={open}
      onOpenChange={next => {
        setOpen(next);
        if (!next) setQuery('');
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          data-testid={testId}
          data-invalid={invalid || undefined}
          className={cn(
            formInputCls,
            sizeCls,
            'flex items-center justify-between gap-2 text-left cursor-pointer min-h-[38px]',
          )}
        >
          <span className="flex flex-wrap items-center gap-1 flex-1 min-w-0">
            {selectedItems.length === 0 ? (
              <span className="truncate text-muted">{placeholderText}</span>
            ) : (
              selectedItems.map(item => {
                const color = itemColor?.(item);
                return (
                  <span
                    key={itemKey(item)}
                    className="inline-flex items-center gap-1.5 px-2 py-0.25 text-body-sm font-medium mono"
                    style={
                      color
                        ? { color, background: `color-mix(in srgb, ${color} 14%, transparent)` }
                        : undefined
                    }
                  >
                    {color && (
                      <span aria-hidden className="h-1.5 w-1.5" style={{ background: color }} />
                    )}
                    {itemLabel(item)}
                  </span>
                );
              })
            )}
          </span>
          <ChevronDownIcon size={13} aria-hidden className="shrink-0 text-muted" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className={cn(
            'z-[80] w-[var(--radix-popover-trigger-width)] rounded-lg border border-hairline bg-surface-2 p-1',
            'shadow-[var(--shadow-float)]',
          )}
        >
          <div className="relative mb-1">
            <SearchIcon
              size={13}
              aria-hidden
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
            />
            <Input
              // eslint-disable-next-line lingui/no-unlocalized-strings -- size variant token, not UI copy
              inputSize="sm"
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={searchPlaceholderText}
              aria-label={searchPlaceholderText}
              className="pl-8"
            />
          </div>

          {maxSelected != null && (
            <p
              aria-live="polite"
              className={cn('px-2.5 py-1 text-body-sm', limitReached ? 'text-warn' : 'text-muted')}
              data-testid={testId ? `${testId}-hint` : undefined}
            >
              {limitReached
                ? t`Maximum of ${maxSelected} selected.`
                : t`Select up to ${maxSelected}.`}
            </p>
          )}

          <div role="listbox" aria-multiselectable className="max-h-[240px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-2.5 py-2 text-body-sm text-muted">{emptyTextResolved}</div>
            ) : matches.length === 0 ? (
              <div className="px-2.5 py-2 text-body-sm text-muted"><Trans>No matches.</Trans></div>
            ) : (
              matches.map(item => {
                const key = itemKey(item);
                const isSel = selectedSet.has(key);
                const optDisabled = !isSel && limitReached;
                const color = itemColor?.(item);
                return (
                  <button
                    key={key}
                    type="button"
                    role="option"
                    aria-selected={isSel}
                    disabled={optDisabled}
                    onClick={() => toggle(item)}
                    data-testid={testId ? `${testId}-option-${key}` : undefined}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-2.5 py-2 text-body text-left rounded-md cursor-pointer',
                      'transition-colors duration-100 hover:bg-[var(--bg-wash-hover)]',
                      'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent',
                    )}
                  >
                    <span
                      aria-hidden
                      className="relative flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border"
                      style={{
                        borderColor: isSel ? (color ?? 'var(--accent-primary)') : 'var(--text-muted)',
                        background: isSel ? (color ?? 'var(--accent-primary)') : 'transparent',
                      }}
                    >
                      {isSel && <CheckIcon size={11} strokeWidth={3} className="text-black" />}
                    </span>
                    <span
                      className="mono text-body-sm font-semibold flex-1 truncate"
                      style={color ? { color: isSel ? color : 'var(--text-secondary)' } : undefined}
                    >
                      {itemLabel(item)}
                    </span>
                    {itemMeta && <span className="text-body-sm text-muted shrink-0">{itemMeta(item)}</span>}
                  </button>
                );
              })
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
