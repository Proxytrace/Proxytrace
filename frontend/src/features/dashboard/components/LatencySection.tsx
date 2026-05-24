// Latency distribution histogram + percentile grid section.

import { Histogram } from '../../../components/charts';
import { EmptyState } from '../../../components/ui/EmptyState';
import { fmtLatency } from '../../../lib/format';
import type { LatencyStats } from '../dashboardMeta';

interface LatencySectionProps {
  latencyHist: number[];
  latencyStats: LatencyStats | null;
}

const PERCENTILE_ROWS = [
  { label: 'p50', color: 'var(--text-primary)' },
  { label: 'p90', color: 'var(--text-primary)' },
  { label: 'p95', color: 'var(--accent-hover)' },
  { label: 'p99', color: 'var(--warn)' },
] as const;

export function LatencySection({ latencyHist, latencyStats }: LatencySectionProps) {
  const pValues = latencyStats
    ? [fmtLatency(latencyStats.p50), fmtLatency(latencyStats.p90), fmtLatency(latencyStats.p95), fmtLatency(latencyStats.p99)]
    : ['—', '—', '—', '—'];

  return (
    <section className="rounded-lg bg-card flex flex-col shadow-[var(--shadow-card)]">
      <header className="px-3 pt-2.5 pb-1.5">
        <h3 className="text-h2 font-semibold">Latency distribution</h3>
        <p className="text-body-sm text-muted mt-0.5 font-mono">
          {latencyStats ? `${latencyStats.samples} samples` : '—'}
        </p>
      </header>
      <div className="px-3 pb-3">
        {latencyHist.length > 0 ? (
          <Histogram
            data={latencyHist}
            height={130}
            color="var(--teal)"
            formatValue={v => `${v} sample${v === 1 ? '' : 's'}`}
          />
        ) : (
          <div className="h-[130px] flex items-center justify-center">
            <EmptyState title="No samples" description="Latency stats appear after traces arrive." />
          </div>
        )}
        <div className="grid grid-cols-4 gap-2 mt-2.5 pt-2.5 border-t border-border-subtle">
          {PERCENTILE_ROWS.map(({ label, color }, idx) => (
            <div key={label}>
              <div className="text-[9px] text-muted font-bold tracking-[0.12em] uppercase font-mono">{label}</div>
              <div className="text-[15px] font-bold tabular-nums mt-[3px]" style={{ color }}>{pValues[idx]}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
