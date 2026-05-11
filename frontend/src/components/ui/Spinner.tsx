interface SpinnerProps {
  size?: 12 | 16 | 24 | 32;
  color?: string;
  className?: string;
}

export function Spinner({ size = 16, color, className = '' }: SpinnerProps) {
  const border = Math.max(1.5, size / 10);
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block rounded-full animate-spin ${className}`}
      style={{
        width: size,
        height: size,
        border: `${border}px solid rgba(255,255,255,0.25)`,
        borderTopColor: color ?? 'currentColor',
      }}
    />
  );
}
