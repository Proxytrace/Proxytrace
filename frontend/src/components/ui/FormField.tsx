import { cn } from '../../lib/cn';

interface FormFieldProps {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

export const formInputCls = cn(
  'w-full px-3 py-2 bg-card-2 border border-border rounded-md',
  'text-title text-primary font-[inherit] outline-none',
  'transition-[border-color,box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-standard)]',
  'focus:border-accent focus:ring-1 focus:ring-[color-mix(in_srgb,var(--accent-primary)_45%,transparent)]',
  'disabled:opacity-50 disabled:cursor-not-allowed',
  'data-[invalid=true]:border-danger data-[invalid=true]:focus:ring-[color-mix(in_srgb,var(--danger)_45%,transparent)]',
);

export function FormField({ label, error, children, className }: FormFieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label className="text-caption font-semibold text-muted uppercase tracking-[0.05em]">{label}</label>
      {children}
      {error && <span className="text-body-sm text-danger">{error}</span>}
    </div>
  );
}
