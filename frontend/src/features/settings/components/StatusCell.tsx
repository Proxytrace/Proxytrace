import { cn } from '../../../lib/cn';

interface StatusCellProps {
  label: string;
  value: string;
  icon?: React.ReactNode;
  valueClassName?: string;
  testId?: string;
}

export function StatusCell({ label, value, icon, valueClassName, testId }: StatusCellProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-body-sm uppercase tracking-wide text-muted font-semibold">{label}</span>
      <span data-testid={testId} className={cn('text-h2 font-semibold text-primary flex items-center gap-1', valueClassName)}>
        {icon}
        {value}
      </span>
    </div>
  );
}
