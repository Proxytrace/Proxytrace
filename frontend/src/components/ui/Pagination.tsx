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
      className={`min-w-[30px] h-[30px] px-1.5 rounded-md text-body-sm font-medium transition-colors border ${
        p === page
          ? 'bg-accent-subtle text-accent border-[color-mix(in_srgb,_var(--accent-primary)_30%,_transparent)]'
          : 'bg-card text-secondary border-border'
      } ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex items-center gap-1">
      {btn('←', page > 1 ? page - 1 : null, page === 1)}
      {pages.map((p, i) =>
        p === '…'
          ? <span key={`ellipsis-${i}`} className="text-body-sm text-muted px-0.5">…</span>
          : btn(p, p as number)
      )}
      {btn('→', page < totalPages ? page + 1 : null, page === totalPages)}
    </div>
  );
}
