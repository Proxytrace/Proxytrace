import type { LabelHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { fieldLabelCls } from './classes';

interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
  children: ReactNode;
}

/**
 * Canonical form-field label (uppercase eyebrow style). Use for every labelled
 * control; `FormField` wraps it automatically.
 */
export function Label({ required, children, className, ...rest }: LabelProps) {
  return (
    <label className={cn(fieldLabelCls, className)} {...rest}>
      {children}
      {required && <span className="text-danger ml-0.5">*</span>}
    </label>
  );
}
