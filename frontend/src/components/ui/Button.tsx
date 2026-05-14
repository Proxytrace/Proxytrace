import React from 'react';
import { cn } from '../../lib/cn';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const VARIANT_CLS: Record<ButtonVariant, string> = {
  primary:
    'bg-[image:var(--grad-accent)] hover:bg-[image:var(--grad-accent-hover)] text-white shadow-[var(--shadow-btn)] disabled:opacity-40 disabled:cursor-not-allowed',
  secondary:
    'bg-card-2 text-secondary border border-border hover:text-primary hover:bg-[var(--bg-wash-active)] disabled:opacity-40 disabled:cursor-not-allowed',
  ghost:
    'text-secondary hover:text-primary hover:bg-[var(--bg-wash-hover)] border border-transparent disabled:opacity-40 disabled:cursor-not-allowed',
  danger:
    'bg-danger text-white shadow-[var(--shadow-btn-danger)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed',
  success:
    'bg-[image:var(--grad-success)] text-white shadow-[var(--shadow-btn-success)] hover:opacity-92 disabled:opacity-40 disabled:cursor-not-allowed',
};

const SIZE_CLS: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1.5 text-body-sm gap-1.5 rounded-md',
  md: 'px-3.5 py-2 text-title gap-2 rounded-md',
  lg: 'px-5 py-2.5 text-title gap-2 rounded-md',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    leftIcon,
    rightIcon,
    fullWidth,
    disabled,
    className,
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading;
  const spinnerSize = size === 'lg' ? 16 : size === 'md' ? 16 : 12;
  const isWriteVariant = variant === 'primary' || variant === 'danger' || variant === 'success';
  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      data-write={isWriteVariant || undefined}
      className={cn(
        'inline-flex items-center justify-center font-semibold whitespace-nowrap select-none',
        'transition-[background,color,opacity,box-shadow] duration-[var(--motion-base)] ease-[var(--ease-standard)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent-primary)_60%,transparent)] focus-visible:ring-offset-0',
        SIZE_CLS[size],
        VARIANT_CLS[variant],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner size={spinnerSize} /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
});

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  danger?: boolean;
}

export function IconButton({ danger, className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      data-write={danger || undefined}
      className={cn('btn-icon', danger && 'btn-icon-danger', className)}
      {...rest}
    />
  );
}
