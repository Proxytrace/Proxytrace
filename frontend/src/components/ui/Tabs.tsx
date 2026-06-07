import * as TabsPrimitive from '@radix-ui/react-tabs';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { FOCUS_RING } from '../../lib/constants';

export interface TabItem {
  value: string;
  label: ReactNode;
  count?: number;
  'data-testid'?: string;
}

interface TabsProps {
  value: string;
  onChange: (value: string) => void;
  items: TabItem[];
  className?: string;
}

/**
 * Underline tab bar (Radix-backed: roving focus + arrow-key nav + ARIA).
 * Controlled; render the active panel yourself from `value`.
 */
export function Tabs({ value, onChange, items, className }: TabsProps) {
  return (
    <TabsPrimitive.Root value={value} onValueChange={onChange}>
      <TabsPrimitive.List className={cn('flex items-center gap-1 border-b border-border', className)}>
        {items.map(item => (
          <TabsPrimitive.Trigger
            key={item.value}
            value={item.value}
            data-testid={item['data-testid']}
            className={cn(
              'group relative -mb-px cursor-pointer whitespace-nowrap px-3 py-2 text-title font-medium',
              'border-b-2 border-transparent text-secondary',
              'transition-colors duration-[var(--motion-fast)] hover:text-primary',
              'data-[state=active]:border-accent data-[state=active]:text-accent',
              FOCUS_RING,
            )}
          >
            {item.label}
            {item.count != null && <span className="mono text-caption opacity-70 ml-1.5">{item.count}</span>}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
    </TabsPrimitive.Root>
  );
}
