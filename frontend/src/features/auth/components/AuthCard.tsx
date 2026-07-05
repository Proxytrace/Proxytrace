import { cn } from '../../../lib/cn';

interface AuthCardProps {
  children: React.ReactNode;
  /** Card width: `md` (w-80, default) for sign-in/reset, `lg` (w-96) for wider migration copy. */
  size?: 'md' | 'lg';
}

/** Centered card shell shared by the unauthenticated auth pages (sign-in, reset, legacy claim). */
export function AuthCard({ children, size = 'md' }: AuthCardProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface text-primary">
      <div
        className={cn(
          size === 'lg' ? 'w-96' : 'w-80',
          'rounded-xl border border-border bg-surface-2 p-6 shadow-[var(--shadow-card)]',
        )}
      >
        {children}
      </div>
    </div>
  );
}
