export interface IconProps {
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function Svg({ size = 16, strokeWidth = 2, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {children}
    </svg>
  );
}
