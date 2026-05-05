interface PaginationProps {
  page: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, total, pageSize, onChange }: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const pages: (number | '…')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('…');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('…');
    pages.push(totalPages);
  }

  const btn = (label: React.ReactNode, p: number | null, disabled = false) => (
    <button
      key={String(label)}
      onClick={() => p != null && onChange(p)}
      disabled={disabled || p == null}
      style={{
        minWidth: '30px', height: '30px', padding: '0 6px',
        borderRadius: '6px', fontSize: '12px', fontWeight: 500,
        background: p === page ? 'var(--accent-subtle)' : 'var(--bg-card)',
        color: p === page ? 'var(--accent-primary)' : 'var(--text-secondary)',
        border: p === page ? '1px solid rgba(201,148,74,0.3)' : '1px solid var(--border-color)',
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.15s',
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      {btn('←', page > 1 ? page - 1 : null, page === 1)}
      {pages.map((p, i) =>
        p === '…'
          ? <span key={`ellipsis-${i}`} style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '0 2px' }}>…</span>
          : btn(p, p as number)
      )}
      {btn('→', page < totalPages ? page + 1 : null, page === totalPages)}
    </div>
  );
}
