import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

type RowButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

/**
 * Unstyled, full-width, left-aligned button for clickable list/selection rows
 * (provider/agent/project rows, trace rows). Row styling is supplied via
 * `className`; this just provides the semantics + sensible row defaults.
 */
export const RowButton = forwardRef<HTMLButtonElement, RowButtonProps>(function RowButton(
  { className, type = 'button', ...rest },
  ref,
) {
  return <button ref={ref} type={type} className={cn('w-full text-left cursor-pointer', className)} {...rest} />;
});
