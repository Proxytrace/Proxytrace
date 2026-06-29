import type { ReactNode } from 'react';

/**
 * A section block in the selection rail (Evaluator, Past evaluation). Each section claims an equal
 * share of the rail height (`flex-1 min-h-0`) with a pinned title; the section's `children` own
 * their own internal scroll (so each list scrolls independently instead of the whole rail moving as
 * one unit, which would let a tall evaluator list overflow and overlap the section below).
 */
export function RailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex-1 min-h-0 flex flex-col gap-2">
      <div className="flex items-center gap-2 px-1 shrink-0">
        <span className="text-caption font-bold uppercase tracking-[0.09em] text-secondary">{title}</span>
      </div>
      {children}
    </section>
  );
}
