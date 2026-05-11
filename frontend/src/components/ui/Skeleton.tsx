import { cn } from '../../lib/cn';

type SkeletonVariant = 'text' | 'block' | 'circle';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  variant?: SkeletonVariant;
  className?: string;
}

const SHAPE_CLS: Record<SkeletonVariant, string> = {
  text: 'rounded-sm',
  block: 'rounded-md',
  circle: 'rounded-full',
};

export function Skeleton({ width, height, variant = 'block', className }: SkeletonProps) {
  return (
    <div
      className={cn('skeleton', SHAPE_CLS[variant], className)}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
    />
  );
}

interface SkeletonListProps {
  rows?: number;
  height?: number;
  gap?: number;
  className?: string;
}

export function SkeletonList({ rows = 5, height = 58, gap = 8, className }: SkeletonListProps) {
  return (
    <div className={cn('flex flex-col', className)} style={{ gap: `${gap}px` }}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={height} />
      ))}
    </div>
  );
}
