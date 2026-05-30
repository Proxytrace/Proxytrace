import { RANGE_KEYS, type RangeKey } from '../../../lib/time-range';

interface Props {
  value: RangeKey;
  onChange: (r: RangeKey) => void;
}

/** Compact 1h/24h/7d/30d range selector. */
export function RangeTabs({ value, onChange }: Props) {
  return (
    <div className="flex gap-1 p-1 bg-card-2 rounded-md" role="tablist" aria-label="Time range">
      {RANGE_KEYS.map(r => (
        <button
          key={r}
          role="tab"
          aria-selected={value === r}
          onClick={() => onChange(r)}
          data-testid={`agent-range-${r}`}
          className={`px-2.5 py-1 text-body-sm font-medium rounded-sm cursor-pointer transition-colors duration-100 ${
            value === r
              ? 'bg-card text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_1px_2px_rgba(0,0,0,0.25)]'
              : 'bg-transparent text-muted hover:text-secondary'
          }`}
        >
          {r}
        </button>
      ))}
    </div>
  );
}
