import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

/**
 * App-root tooltip provider. Mount once near the top of the tree.
 */
export function TooltipProvider({ children, delayDuration = 300 }: { children: ReactNode; delayDuration?: number }) {
  return <TooltipPrimitive.Provider delayDuration={delayDuration}>{children}</TooltipPrimitive.Provider>;
}

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
}

/**
 * Hover/focus tooltip (Radix-backed). Wrap a single focusable element; renders
 * nothing extra when `content` is empty. Requires a `TooltipProvider` ancestor.
 */
export function Tooltip({ content, children, side = 'top', align = 'center' }: TooltipProps) {
  if (content == null || content === '') return <>{children}</>;
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          align={align}
          sideOffset={6}
          className={cn(
            'z-[80] max-w-xs select-none rounded-md border border-hairline bg-surface-2 px-2 py-1',
            'text-body-sm text-primary shadow-[var(--shadow-float)]',
          )}
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-[var(--bg-secondary)]" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
