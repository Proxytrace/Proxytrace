import type { ReactNode } from 'react';

/** A numbered step block in the selection rail (① Evaluator, ② Past evaluation). */
export function RailSection({ step, title, children }: { step: string; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 min-h-0">
      <div className="flex items-center gap-2 px-1">
        <span className="w-[18px] h-[18px] rounded-sm bg-accent-subtle text-accent-text text-[10.5px] font-bold inline-flex items-center justify-center shrink-0">
          {step}
        </span>
        <span className="text-[10.5px] font-bold uppercase tracking-[0.09em] text-secondary">{title}</span>
      </div>
      {children}
    </div>
  );
}
