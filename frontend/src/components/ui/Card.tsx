import React from 'react';
import { cn } from '../../lib/cn';

export type CardElevation = 'flat' | 'raised' | 'floating';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevation?: CardElevation;
  padding?: CardPadding;
  accentBar?: string;
  hoverGlow?: string;
  selected?: boolean;
  interactive?: boolean;
}

const ELEVATION_CLS: Record<CardElevation, string> = {
  flat: cn('bg-card border border-hairline rounded-lg'),
  raised: cn('bg-card rounded-lg shadow-[var(--shadow-card)]'),
  floating: cn('bg-surface-2 rounded-xl shadow-[var(--shadow-float)] border border-border'),
};

const PADDING_CLS: Record<CardPadding, string> = {
  none: '',
  sm: cn('p-3'),
  md: cn('p-4'),
  lg: cn('p-5'),
};

export function Card({
  elevation = 'raised',
  padding = 'md',
  accentBar,
  hoverGlow,
  selected,
  interactive,
  className,
  style,
  children,
  ...rest
}: CardProps) {
  const hoverStyle = hoverGlow
    ? ({
        '--card-hover-glow': `color-mix(in srgb, ${hoverGlow} 32%, transparent)`,
      } as React.CSSProperties)
    : undefined;

  return (
    <div
      className={cn(
        'relative overflow-hidden transition-[box-shadow,transform] duration-[var(--motion-base)] ease-[var(--ease-standard)]',
        ELEVATION_CLS[elevation],
        PADDING_CLS[padding],
        (interactive || hoverGlow) && 'cursor-pointer',
        hoverGlow && 'hover:shadow-[0_0_0_1px_var(--card-hover-glow),var(--shadow-card)]',
        selected && 'ring-1 ring-accent',
        className,
      )}
      style={{ ...hoverStyle, ...style }}
      {...rest}
    >
      {accentBar && (
        <span
          aria-hidden
          className="absolute left-0 top-0 right-0 h-[3px] pointer-events-none"
          style={{ background: accentBar }}
        />
      )}
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

function CardHeader({ title, description, action, className, children }: CardHeaderProps) {
  if (children) {
    return <div className={cn('flex items-center gap-3', className)}>{children}</div>;
  }
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <div className="flex-1 min-w-0">
        {title && <h3 className="text-h2 font-semibold text-primary m-0 leading-tight truncate">{title}</h3>}
        {description && <p className="text-body-sm text-muted m-0 mt-0.5">{description}</p>}
      </div>
      {action && <div className="flex items-center gap-1.5 shrink-0">{action}</div>}
    </div>
  );
}

function CardBody({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('mt-3', className)} {...rest}>
      {children}
    </div>
  );
}

function CardFooter({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('mt-3 pt-3 border-t border-hairline flex items-center gap-2', className)} {...rest}>
      {children}
    </div>
  );
}

Card.Header = CardHeader;
Card.Body = CardBody;
Card.Footer = CardFooter;
