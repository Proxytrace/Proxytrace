import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { CheckIcon, ChevronDownIcon } from '../icons';
import { cn } from '../../lib/cn';

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
  /** Whether the menu opens below ('down', default) or above ('up') the trigger. */
  direction?: 'down' | 'up';
  width?: number;
  /**
   * `md` (default) — the standalone toolbar filter chip (filled, 36px).
   * `sm` — a compact, quiet trigger for inline/header use (transparent, 28px); avoids the
   * oversized filled pill warping a dense header row.
   */
  size?: 'sm' | 'md';
  /** When set, tags the trigger `{testId}` and each option `{testId}-option-{key}` for e2e. */
  testId?: string;
}

/**
 * Labelled single-select filter pill (Radix DropdownMenu-backed: portalled,
 * collision-aware, keyboard-navigable). API-compatible drop-in.
 */
export function FilterDropdown({
  label,
  value,
  options,
  onChange,
  active,
  accent,
  align = 'left',
  direction = 'down',
  width = 200,
  size = 'md',
  testId,
}: FilterDropdownProps) {
  const selected = options.find(o => o.key === value);
  const displayLabel = selected?.label ?? value;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          data-testid={testId}
          className={cn(
            'group inline-flex items-center leading-none font-medium whitespace-nowrap cursor-pointer transition-colors duration-150',
            size === 'sm'
              ? 'h-7 gap-1 px-2 rounded-sm text-body-sm'
              : 'h-9 gap-1.5 px-2.5 rounded-md text-body',
            size === 'sm'
              ? 'bg-transparent text-secondary hover:text-primary hover:bg-card-2'
              : active
                ? 'bg-card-2 text-primary shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_1px_2px_rgba(0,0,0,0.3)]'
                : 'bg-card text-secondary hover:text-primary shadow-[var(--shadow-pill)]',
          )}
        >
          {accent && <span className="w-[7px] h-[7px] rounded-[2px] shrink-0" style={{ background: accent }} />}
          {label && <span className="text-muted font-medium">{label}</span>}
          <span>{displayLabel}</span>
          <ChevronDownIcon
            size={12}
            strokeWidth={2.5}
            className="text-muted ml-0.5 transition-transform duration-150 group-data-[state=open]:rotate-180"
          />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align === 'right' ? 'end' : 'start'}
          side={direction === 'up' ? 'top' : 'bottom'}
          sideOffset={6}
          style={{ minWidth: width }}
          className="z-[60] bg-card-2 rounded-md py-1 max-h-[280px] overflow-y-auto shadow-[var(--shadow-float)] ring-1 ring-[rgba(255,255,255,0.06)]"
        >
          {options.map(opt => {
            const isSel = opt.key === value;
            return (
              <DropdownMenu.Item
                key={opt.key}
                data-testid={testId ? `${testId}-option-${opt.key}` : undefined}
                onSelect={() => onChange(opt.key)}
                className={cn(
                  'flex items-center gap-2 px-2.5 py-1.5 text-body text-left cursor-pointer outline-none transition-colors duration-100 data-[highlighted]:bg-white/[0.05]',
                  isSel ? 'text-primary' : 'text-secondary',
                )}
              >
                {opt.accent && <span className="w-[8px] h-[8px] rounded-[2px] shrink-0" style={{ background: opt.accent }} />}
                <span className="flex-1 truncate">{opt.label}</span>
                {isSel && <CheckIcon size={12} strokeWidth={2.5} className="text-accent shrink-0" />}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
