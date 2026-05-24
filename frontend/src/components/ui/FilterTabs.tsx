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
            className={`flex items-center gap-[5px] px-3 py-[5px] rounded-lg text-xs font-semibold transition-colors border ${
              active
                ? 'bg-accent-subtle text-accent border-[color-mix(in_srgb,_var(--accent-primary)_30%,_transparent)]'
                : 'bg-card text-secondary border-border'
            }`}
          >
            {opt.label}
            {opt.count != null && (
              <span
                className={`text-[10px] font-semibold px-[5px] py-[1px] rounded-full ${active ? 'text-accent bg-[color-mix(in_srgb,_var(--accent-primary)_20%,_transparent)]' : 'text-muted bg-card-2'}`}
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
