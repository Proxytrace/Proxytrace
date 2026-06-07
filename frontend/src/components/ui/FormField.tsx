import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Label } from './Label';

interface FormFieldProps {
  label: string;
  error?: string;
  htmlFor?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function FormField({ label, error, htmlFor, required, children, className }: FormFieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={htmlFor} required={required}>{label}</Label>
      {children}
      {error && <span className="text-body-sm text-danger">{error}</span>}
    </div>
  );
}
