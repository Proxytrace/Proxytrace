import React from 'react';
import { cn } from '../../lib/cn';
import { formInputCls } from './classes';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, className, rows = 4, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      data-invalid={invalid || undefined}
      className={cn(formInputCls, 'min-h-[80px] resize-y leading-relaxed', className)}
      {...rest}
    />
  );
});
