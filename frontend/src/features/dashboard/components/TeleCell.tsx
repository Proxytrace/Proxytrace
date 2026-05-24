// Single cell in the telemetry strip (label + value).

interface TeleCellProps {
  label: string;
  value: string;
  accent?: boolean;
}

export function TeleCell({ label, value, accent = false }: TeleCellProps) {
  return (
    <div className="flex flex-col gap-[3px] pr-5 mr-5 border-r border-border-subtle whitespace-nowrap last:border-r-0">
      <span className="text-[9px] text-muted tracking-[0.14em] uppercase font-bold font-mono">{label}</span>
      <span className={`text-[12.5px] font-mono font-semibold tabular-nums ${accent ? 'text-accent-hover' : 'text-primary'}`}>
        {value}
      </span>
    </div>
  );
}
