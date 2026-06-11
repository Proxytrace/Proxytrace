interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

/** Consistent header for a settings section: title, optional subtitle, optional right-aligned action. */
export function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4 shrink-0">
      <div className="min-w-0">
        <h1 className="text-h1 font-semibold m-0 text-primary">{title}</h1>
        {subtitle && <p className="text-body-sm text-muted m-0 mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
