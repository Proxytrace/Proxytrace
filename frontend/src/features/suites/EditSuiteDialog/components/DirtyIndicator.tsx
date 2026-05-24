interface Props {
  count: number;
}

export function DirtyIndicator({ count }: Props) {
  if (count === 0) {
    return <span className="text-[11.5px] text-muted">No changes</span>;
  }
  return (
    <span
      className="inline-flex items-center gap-[5px] px-[10px] py-[3px] rounded-full text-[11.5px] font-semibold"
      style={{
        background: 'var(--accent-subtle)',
        color: 'var(--accent-hover)',
        border: '1px solid var(--accent-primary)',
      }}
    >
      <span className="w-[6px] h-[6px] rounded-full bg-[color:var(--accent-primary)]" />
      {count} unsaved {count === 1 ? 'change' : 'changes'}
    </span>
  );
}
