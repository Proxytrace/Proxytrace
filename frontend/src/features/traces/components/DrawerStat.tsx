interface DrawerStatProps {
  label: string;
  value?: string;
  sub?: React.ReactNode;
  icon: React.ReactNode;
  color: string;
  valueColor?: string;
  children?: React.ReactNode;
  valueTestId?: string;
}

export function DrawerStat({ label, value, sub, icon, color, valueColor, children, valueTestId }: DrawerStatProps) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2.5">
        <div
          className="w-9 h-9 rounded-md flex items-center justify-center shrink-0"
          style={{
            background: `color-mix(in srgb, ${color} 14%, transparent)`,
            color,
            boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 32%, transparent)`,
          }}
        >
          {icon}
        </div>
        <div className="min-w-0 leading-tight">
          <div className="text-caption text-muted font-medium tracking-[0.05em] uppercase">{label}</div>
          {value !== undefined && (
            <div data-testid={valueTestId} className="text-h1 font-bold mt-0.5 font-mono" style={{ color: valueColor ?? 'var(--text-primary)' }}>
              {value}
            </div>
          )}
          {children}
        </div>
      </div>
      {sub && <div className="text-caption text-muted mt-1 ml-[46px]">{sub}</div>}
    </div>
  );
}
