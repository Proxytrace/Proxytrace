import { cn } from '../../lib/cn';

interface FormFieldProps {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormField({ label, error, children, className }: FormFieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label className="text-caption font-semibold text-muted uppercase tracking-[0.05em]">{label}</label>
      {children}
      {error && <span className="text-body-sm text-danger">{error}</span>}
    </div>
  );
}
