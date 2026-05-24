interface DrawerStatProps {
  label: string;
  value?: string;
  sub?: React.ReactNode;
  icon: React.ReactNode;
  color: string;
  valueColor?: string;
  children?: React.ReactNode;
}

export function DrawerStat({ label, value, sub, icon, color, valueColor, children }: DrawerStatProps) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-[10px]">
        <div
          className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
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
            <div className="text-[15px] font-bold mt-[2px] font-mono" style={{ color: valueColor ?? 'var(--text-primary)' }}>
              {value}
            </div>
          )}
          {children}
        </div>
      </div>
      {sub && <div className="text-caption text-muted mt-[4px] ml-[46px]">{sub}</div>}
    </div>
  );
}
