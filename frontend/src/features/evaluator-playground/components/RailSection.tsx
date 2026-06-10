import type { ReactNode } from 'react';

/** A section block in the selection rail (Evaluator, Past evaluation). */
export function RailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 min-h-0">
      <div className="flex items-center gap-2 px-1">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.09em] text-secondary">{title}</span>
      </div>
      {children}
    </div>
  );
}
