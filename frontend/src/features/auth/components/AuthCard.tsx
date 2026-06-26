/** Centered card shell shared by the unauthenticated password-reset pages. */
export function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface text-primary">
      <div className="w-80 rounded-xl border border-border bg-surface-2 p-6 shadow-[var(--shadow-card)]">
        {children}
      </div>
    </div>
  );
}
