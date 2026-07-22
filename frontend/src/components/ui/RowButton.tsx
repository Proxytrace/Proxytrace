import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';
import { FOCUS_RING_ROW } from '../../lib/constants';

type RowButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

/**
 * Unstyled, full-width, left-aligned button for clickable list/selection rows
 * (provider/agent/project rows, trace rows). Row styling is supplied via
 * `className`; this just provides the semantics + sensible row defaults.
 *
 * Carries `FOCUS_RING_ROW` so every row is keyboard-visible without each call site remembering —
 * an inward outline rather than a ring, because rows are full-bleed inside scroll containers and
 * a selected row's inline `box-shadow` would swallow one (see the constant). Call sites should not
 * add a focus class of their own.
 */
export const RowButton = forwardRef<HTMLButtonElement, RowButtonProps>(function RowButton(
  { className, type = 'button', ...rest },
  ref,
) {
  return <button ref={ref} type={type} className={cn('w-full text-left cursor-pointer', FOCUS_RING_ROW, className)} {...rest} />;
});
