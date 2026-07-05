// Latency spectrum — per-endpoint min→max span bars on a shared log scale with
// p50/p95/p99 markers, plus the project-wide percentile strip.

import { Trans, Plural, useLingui } from '@lingui/react/macro';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { logSpanPos } from '../../../components/charts';
import { fmtLatency } from '../../../lib/format';
import {
  EYEBROW_CLS,
  COL_HEADER_CLS,
  PERCENTILES,
  SPECTRUM_MARKERS,
  type EndpointLatencyRow,
  type LatencyStats,
} from '../dashboardMeta';

const MAX_ROWS = 4;

interface LatencySectionProps {
  rows: EndpointLatencyRow[];
  latencyStats: LatencyStats | null;
  isLoading: boolean;
}

export function LatencySection({ rows, latencyStats, isLoading }: LatencySectionProps) {
  const { t } = useLingui();
  const visible = rows.slice(0, MAX_ROWS);
  // Shared log-scale bounds across all span rows; only meaningful when rows exist
  // (the empty branch below never reads them).
  let lo = Number.POSITIVE_INFINITY;
  let hi = 0;
  for (const r of visible) {
    if (r.minMs < lo) lo = r.minMs;
    if (r.maxMs > hi) hi = r.maxMs;
  }

  return (
    <section data-testid="latency-section" className="relative overflow-hidden rounded-lg bg-card px-3.5 pt-2.5 pb-3 flex flex-col shadow-[var(--shadow-card)]">
      <div className="absolute -top-16 -right-12 w-[300px] h-[220px] pointer-events-none bg-[radial-gradient(ellipse,color-mix(in_srgb,var(--teal)_7%,transparent),transparent_70%)]" />

      <header className="relative flex items-end justify-between mb-2.5">
        <div>
          <span className={EYEBROW_CLS}>
            <Trans>Latency spectrum</Trans>
          </span>
          <p className="text-body-sm text-muted mt-0.5 font-mono">
            {latencyStats ? <Plural value={latencyStats.samples} one="# sample" other="# samples" /> : '—'}
            {' · '}
            <Trans>min→max per endpoint</Trans>
          </p>
        </div>
        <div className="flex items-center gap-3 text-caption font-mono text-muted whitespace-nowrap">
          {SPECTRUM_MARKERS.map(m => (
            <span key={m.key} className="inline-flex items-center gap-1">
              <span className="size-[7px] rounded-full" style={{ background: m.color }} />
              {m.key}
            </span>
          ))}
        </div>
      </header>

      <div className="relative flex-1 flex flex-col justify-center gap-3">
        {isLoading ? (
          Array.from({ length: 3 }, (_, i) => <Skeleton key={i} height={30} className="rounded-sm" />)
        ) : visible.length === 0 ? (
          <div className="py-6">
            <EmptyState title={t`No samples`} description={t`Latency stats appear after traces arrive.`} />
          </div>
        ) : (
          <>
            {visible.map(r => (
              <LatencySpanRow key={r.endpointId} row={r} lo={lo} hi={hi} />
            ))}
            {rows.length > visible.length && (
              <p className="text-caption text-muted font-mono">
                <Plural value={rows.length - visible.length} one="+# more endpoint" other="+# more endpoints" />
              </p>
            )}
            <div className="flex justify-between text-caption text-muted font-mono tabular-nums" aria-hidden="true">
              <span>{fmtLatency(lo)}</span>
              <span>{fmtLatency(hi)}</span>
            </div>
          </>
        )}
      </div>

      <div className="relative grid grid-cols-4 gap-2 mt-2.5 pt-2.5 border-t border-border-subtle">
        {PERCENTILES.map(p => (
          <div key={p.key}>
            <div className={COL_HEADER_CLS}>{p.key}</div>
            <div className="text-h1 font-bold tabular-nums mt-0.5" style={{ color: p.color }}>
              {latencyStats ? fmtLatency(latencyStats[p.key]) : '—'}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

interface LatencySpanRowProps {
  row: EndpointLatencyRow;
  lo: number;
  hi: number;
}

function LatencySpanRow({ row, lo, hi }: LatencySpanRowProps) {
  const { t } = useLingui();
  const left = logSpanPos(row.minMs, lo, hi) * 100;
  const right = logSpanPos(row.maxMs, lo, hi) * 100;

  return (
    <div
      data-testid={`latency-endpoint-${row.endpointId}`}
      title={t`min ${fmtLatency(row.minMs)} · p50 ${fmtLatency(row.p50Ms)} · p95 ${fmtLatency(row.p95Ms)} · p99 ${fmtLatency(row.p99Ms)} · max ${fmtLatency(row.maxMs)}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-body-sm text-secondary font-mono truncate">{row.name}</span>
        <span className="text-caption text-muted font-mono tabular-nums whitespace-nowrap">
          <Plural value={row.samples} one="# sample" other="# samples" />
        </span>
      </div>
      <div className="relative h-3 mt-1">
        <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-border-subtle" />
        <span
          className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-[color-mix(in_srgb,var(--teal)_32%,transparent)]"
          style={{ left: `${left}%`, width: `${Math.max(right - left, 1)}%` }}
        />
        {SPECTRUM_MARKERS.map(m => (
          <span
            key={m.key}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-[7px] rounded-full"
            style={{
              left: `${logSpanPos(row[m.rowKey], lo, hi) * 100}%`,
              background: m.color,
              boxShadow: `0 0 8px ${m.color}`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
