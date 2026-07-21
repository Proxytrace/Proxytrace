// ---------------------------------------------------------------------------
// PreviewSection: titled content block
// ---------------------------------------------------------------------------

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

export function PreviewSection({ title, children }: SectionProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-caption uppercase tracking-wider text-muted font-semibold">{title}</div>
      {children}
    </div>
  );
}
