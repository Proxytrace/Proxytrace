import { useId } from 'react';
import type { AgentOverviewDto } from '../../../api/models';
import { AreaChart } from '../../../components/charts';
import { RANGE_KEYS, rangeLabel, type RangeKey } from '../../../lib/time-range';
import { Widget } from './Widget';

interface Props {
  overview: AgentOverviewDto;
  range: RangeKey;
  onRangeChange: (range: RangeKey) => void;
  className?: string;
}

function RangeTabs({ value, onChange }: { value: RangeKey; onChange: (r: RangeKey) => void }) {
  return (
    <div className="flex gap-1 p-1 bg-card-2 rounded-[10px]">
      {RANGE_KEYS.map(r => (
        <button
          key={r}
          onClick={() => onChange(r)}
          style={{
            boxShadow: value === r ? '0 1px 0 rgba(255,255,255,0.06) inset, 0 1px 2px rgba(0,0,0,0.25)' : 'none',
          }}
          className={`px-[10px] py-[4px] text-[11px] font-medium rounded-[7px] cursor-pointer ${
            value === r ? 'bg-card text-primary' : 'bg-transparent text-muted'
          }`}
        >
          {r}
        </button>
      ))}
    </div>
  );
}

function MiniChart({ title, data, color, gradientId, height = 96 }: { title: string; data: number[]; color: string; gradientId: string; height?: number }) {
  const hasData = data.length >= 2 && data.some(v => v > 0);
  return (
    <div className="bg-card-2 rounded-xl p-3 flex flex-col gap-2 min-w-0" style={{ boxShadow: 'var(--shadow-card)' }}>
      <span className="text-[11.5px] font-semibold text-secondary tracking-[0.02em]">{title}</span>
      {hasData ? (
        <AreaChart data={data} width={420} height={height} color={color} gradientId={gradientId} showAxis={false} />
      ) : (
        <div className="flex items-center justify-center text-[11px] text-muted" style={{ height }}>
          No data in range
        </div>
      )}
    </div>
  );
}

export function ChartsWidget({ overview, range, onRangeChange, className }: Props) {
  const uid = useId();
  const traces = overview.timeSeries.map(p => p.traceCount);
  const tokens = overview.timeSeries.map(p => p.inputTokens + p.outputTokens);
  const costs = overview.timeSeries.map(p => p.costEur);

  const expanded = (
    <div className="flex flex-col gap-3">
      <div className="text-[11px] text-muted">{rangeLabel(range)}</div>
      <MiniChart title="Traces" data={traces} color="#c9944a" gradientId={`${uid}-tracesXL`} height={200} />
      <MiniChart title="Tokens" data={tokens} color="#6b9eaa" gradientId={`${uid}-tokensXL`} height={200} />
      <MiniChart title="Cost" data={costs} color="#d4915c" gradientId={`${uid}-costXL`} height={200} />
    </div>
  );

  return (
    <Widget
      title="Activity"
      right={<RangeTabs value={range} onChange={onRangeChange} />}
      className={className}
      expandTitle={`Activity · ${rangeLabel(range)}`}
      expandContent={expanded}
      expandMaxWidth={760}
    >
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <MiniChart title="Traces" data={traces} color="#c9944a" gradientId={`${uid}-traces`} />
        <MiniChart title="Tokens" data={tokens} color="#6b9eaa" gradientId={`${uid}-tokens`} />
        <MiniChart title="Cost" data={costs} color="#d4915c" gradientId={`${uid}-cost`} />
      </div>
    </Widget>
  );
}
