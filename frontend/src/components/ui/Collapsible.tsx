import { useState } from 'react';
import { ChevronRightIcon } from '../icons';

interface CollapsibleProps {
  title: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  headerClassName?: string;
  contentClassName?: string;
}

export function Collapsible({ title, defaultOpen = false, children, headerClassName, contentClassName }: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full text-left flex items-center gap-2 bg-transparent ${headerClassName ?? ''}`}
      >
        <span
          className={`inline-flex shrink-0 transition-transform duration-[150ms] ${open ? 'rotate-90' : 'rotate-0'}`}
        >
          <ChevronRightIcon size={10} strokeWidth={2.5} />
        </span>
        {title}
      </button>
      {open && <div className={contentClassName}>{children}</div>}
    </>
  );
}
