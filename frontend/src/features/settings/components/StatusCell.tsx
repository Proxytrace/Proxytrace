import { cn } from '../../../lib/cn';

interface StatusCellProps {
  label: string;
  value: string;
  icon?: React.ReactNode;
  valueClassName?: string;
}

export function StatusCell({ label, value, icon, valueClassName }: StatusCellProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wide text-muted font-semibold">{label}</span>
      <span className={cn('text-[14px] font-semibold text-primary flex items-center gap-1', valueClassName)}>
        {icon}
        {value}
      </span>
    </div>
  );
}
