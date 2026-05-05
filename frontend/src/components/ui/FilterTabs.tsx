interface TabOption {
  label: string;
  value: string;
  count?: number;
}

interface FilterTabsProps {
  options: TabOption[];
  value: string;
  onChange: (value: string) => void;
}

export function FilterTabs({ options, value, onChange }: FilterTabsProps) {
  return (
    <div className="flex gap-1 flex-wrap">
      {options.map(opt => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              border: active ? '1px solid rgba(201,148,74,0.3)' : '1px solid var(--border-color)',
            }}
            className={`flex items-center gap-[5px] px-3 py-[5px] rounded-lg text-xs font-semibold transition-colors ${
              active
                ? 'bg-accent-subtle text-accent'
                : 'bg-card text-secondary'
            }`}
          >
            {opt.label}
            {opt.count != null && (
              <span
                style={{
                  background: active ? 'rgba(201,148,74,0.2)' : 'var(--bg-card-2)',
                }}
                className={`text-[10px] font-semibold px-[5px] py-[1px] rounded-full ${active ? 'text-accent' : 'text-muted'}`}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
