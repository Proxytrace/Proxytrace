interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-15 px-5 text-center">
      <div className="w-12 h-12 rounded-xl bg-card border border-border flex items-center justify-center text-xl text-muted">
        ∅
      </div>
      <div>
        <div className="text-body font-semibold text-primary">{title}</div>
        {description && (
          <div className="text-title text-muted mt-1">{description}</div>
        )}
      </div>
      {action}
    </div>
  );
}
