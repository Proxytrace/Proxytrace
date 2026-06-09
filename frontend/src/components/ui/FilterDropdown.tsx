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
            'group inline-flex items-center gap-[6px] h-9 px-[10px] rounded-[8px] text-[12px] font-medium whitespace-nowrap cursor-pointer transition-colors duration-150',
            active
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
            className="text-muted ml-[2px] transition-transform duration-150 group-data-[state=open]:rotate-180"
          />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align === 'right' ? 'end' : 'start'}
          side={direction === 'up' ? 'top' : 'bottom'}
          sideOffset={6}
          style={{ minWidth: width }}
          className="z-[60] bg-card-2 rounded-[10px] py-1 max-h-[280px] overflow-y-auto shadow-[0_12px_32px_-8px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.06)]"
        >
          {options.map(opt => {
            const isSel = opt.key === value;
            return (
              <DropdownMenu.Item
                key={opt.key}
                data-testid={testId ? `${testId}-option-${opt.key}` : undefined}
                onSelect={() => onChange(opt.key)}
                className={cn(
                  'flex items-center gap-2 px-[10px] py-[7px] text-[12.5px] text-left cursor-pointer outline-none transition-colors duration-100 data-[highlighted]:bg-[rgba(255,255,255,0.05)]',
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
