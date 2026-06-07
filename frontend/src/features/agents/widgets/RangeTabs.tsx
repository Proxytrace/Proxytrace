import { RANGE_KEYS, type RangeKey } from '../../../lib/time-range';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';

interface Props {
  value: RangeKey;
  onChange: (r: RangeKey) => void;
}

/** Compact 1h/24h/7d/30d range selector. */
export function RangeTabs({ value, onChange }: Props) {
  return (
    <SegmentedControl
      value={value}
      onChange={onChange}
      segments={RANGE_KEYS.map(r => ({ value: r, label: r }))}
    />
  );
}
