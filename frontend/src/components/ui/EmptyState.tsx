interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: '12px', padding: '60px 20px', textAlign: 'center',
    }}>
      <div style={{
        width: '48px', height: '48px', borderRadius: '12px',
        background: 'var(--bg-card)', border: '1px solid var(--border-color)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '20px', color: 'var(--text-muted)',
      }}>
        ∅
      </div>
      <div>
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{title}</div>
        {description && (
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>{description}</div>
        )}
      </div>
      {action}
    </div>
  );
}
