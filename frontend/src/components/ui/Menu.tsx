import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface MenuProps {
  /** Single element rendered as the trigger (via `asChild`) — e.g. an `IconButton`. */
  trigger: ReactNode;
  children: ReactNode;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
}

/**
 * Dropdown menu (Radix-backed): portalled, collision-aware, keyboard-navigable.
 * Compose with `Menu.Item` and `Menu.Separator`.
 */
export function Menu({ trigger, children, align = 'end', side = 'bottom' }: MenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          side={side}
          sideOffset={6}
          className={cn(
            'z-[80] min-w-[180px] overflow-hidden rounded-lg border border-hairline bg-surface-2 py-1',
            'shadow-[var(--shadow-float)]',
          )}
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

interface MenuItemProps {
  children: ReactNode;
  onSelect?: () => void;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  'data-testid'?: string;
}

function MenuItem({ children, onSelect, icon, danger, disabled, 'data-testid': testId }: MenuItemProps) {
  return (
    <DropdownMenu.Item
      disabled={disabled}
      onSelect={onSelect}
      data-testid={testId}
      className={cn(
        'flex items-center gap-2 px-3.5 py-2 text-body cursor-pointer outline-none',
        'text-secondary data-[highlighted]:bg-[var(--bg-wash-hover)] data-[highlighted]:text-primary',
        'data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed',
        danger && 'text-danger data-[highlighted]:text-danger',
      )}
    >
      {icon}
      {children}
    </DropdownMenu.Item>
  );
}

function MenuSeparator() {
  return <DropdownMenu.Separator className="my-1 h-px bg-hairline" />;
}

Menu.Item = MenuItem;
Menu.Separator = MenuSeparator;
