import * as RadixPopover from '@radix-ui/react-popover';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface PopoverProps {
  /** Single element rendered as the trigger (via `asChild`) — e.g. a `Button`. */
  trigger: ReactNode;
  children: ReactNode;
  /** Controlled open state. Omit for uncontrolled (Radix manages it). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** Extra classes on the floating panel (layout/sizing — visual chrome is fixed by the primitive). */
  className?: string;
}

/**
 * Floating panel anchored to a trigger (Radix Popover-backed): portalled, collision-aware,
 * focus-trapped, closes on Esc / outside-click. Use for rich popovers that hold inputs or
 * multi-control layouts (filters, pickers) — for a flat list of actions use `Menu` instead.
 */
export function Popover({
  trigger,
  children,
  open,
  onOpenChange,
  align = 'start',
  side = 'bottom',
  className,
}: PopoverProps) {
  return (
    <RadixPopover.Root open={open} onOpenChange={onOpenChange}>
      <RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          align={align}
          side={side}
          sideOffset={6}
          collisionPadding={12}
          className={cn(
            'z-[80] rounded-xl border border-hairline bg-surface-2 shadow-[var(--shadow-float)]',
            'focus:outline-none',
            className,
          )}
        >
          {children}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}
