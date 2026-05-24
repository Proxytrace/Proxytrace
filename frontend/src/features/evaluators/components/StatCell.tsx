import { cn } from '../../../lib/cn';

interface Props {
  label: string;
  value: string;
  sub: string;
  /** Tailwind text-color class for the value (e.g. `text-success`, `categoryText[cat]`). */
  valueClass: string;
  big?: boolean;
  last?: boolean;
}

/** One metric cell inside the performance grid. */
export function StatCell({ label, value, sub, valueClass, big = false, last = false }: Props) {
  return (
    <div className={cn('flex flex-col gap-1 px-[18px] py-4', !last && 'border-r border-hairline')}>
      <div className="text-[10px] text-muted uppercase tracking-[0.08em] font-semibold">{label}</div>
      <div className={cn('font-bold font-mono tracking-[-0.03em] leading-[1.1]', big ? 'text-[26px]' : 'text-[20px]', valueClass)}>
        {value}
      </div>
      <div className="text-[10.5px] text-muted font-mono">{sub}</div>
    </div>
  );
}
