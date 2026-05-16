import React from 'react';
import { cn } from '../../lib/cn';
import { formInputCls } from './classes';

type Size = 'sm' | 'md';

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  inputSize?: Size;
  invalid?: boolean;
}

const SIZE_CLS: Record<Size, string> = {
  sm: 'px-2.5 py-1.5 text-body-sm',
  md: 'px-3 py-2 text-title',
};

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { inputSize = 'md', invalid, className, children, ...rest },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        data-invalid={invalid || undefined}
        className={cn(
          formInputCls,
          SIZE_CLS[inputSize],
          'appearance-none pr-9 cursor-pointer',
          className,
        )}
        {...rest}
      >
        {children}
      </select>
      <svg
        aria-hidden
        className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  );
});
