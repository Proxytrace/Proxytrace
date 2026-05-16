import React from 'react';
import { cn } from '../../lib/cn';
import { formInputCls } from './classes';

type Size = 'sm' | 'md';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
  inputSize?: Size;
  invalid?: boolean;
  leftAddon?: React.ReactNode;
  rightAddon?: React.ReactNode;
}

const SIZE_CLS: Record<Size, string> = {
  sm: 'px-2.5 py-1.5 text-body-sm',
  md: 'px-3 py-2 text-title',
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { inputSize = 'md', invalid, leftAddon, rightAddon, className, ...rest },
  ref,
) {
  if (leftAddon || rightAddon) {
    return (
      <div
        className={cn(
          'relative flex items-center w-full bg-card-2 border border-border rounded-md',
          'transition-[border-color,box-shadow] duration-[var(--motion-fast)]',
          'focus-within:border-accent focus-within:ring-1 focus-within:ring-[color-mix(in_srgb,var(--accent-primary)_45%,transparent)]',
          invalid && 'border-danger focus-within:ring-[color-mix(in_srgb,var(--danger)_45%,transparent)]',
        )}
      >
        {leftAddon && <span className="pl-3 text-secondary flex items-center text-body-sm">{leftAddon}</span>}
        <input
          ref={ref}
          data-invalid={invalid || undefined}
          className={cn(
            'flex-1 bg-transparent border-none outline-none text-primary font-[inherit]',
            SIZE_CLS[inputSize],
            className,
          )}
          {...rest}
        />
        {rightAddon && <span className="pr-3 text-secondary flex items-center text-body-sm">{rightAddon}</span>}
      </div>
    );
  }
  return (
    <input
      ref={ref}
      data-invalid={invalid || undefined}
      className={cn(formInputCls, SIZE_CLS[inputSize], className)}
      {...rest}
    />
  );
});
