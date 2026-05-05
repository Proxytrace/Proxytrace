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
    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
      {options.map(opt => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              padding: '5px 12px', borderRadius: '8px',
              fontSize: '12px', fontWeight: 600,
              background: active ? 'var(--accent-subtle)' : 'var(--bg-card)',
              color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
              border: active ? '1px solid rgba(201,148,74,0.3)' : '1px solid var(--border-color)',
              transition: 'background 0.15s, color 0.15s',
              display: 'flex', alignItems: 'center', gap: '5px',
            }}
          >
            {opt.label}
            {opt.count != null && (
              <span style={{
                fontSize: '10px', fontWeight: 600,
                padding: '1px 5px', borderRadius: '100px',
                background: active ? 'rgba(201,148,74,0.2)' : 'var(--bg-card-2)',
                color: active ? 'var(--accent-primary)' : 'var(--text-muted)',
              }}>
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
