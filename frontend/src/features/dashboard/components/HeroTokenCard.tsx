// Hero token-volume card with area chart and model split bar.

import { AreaChart } from '../../../components/charts';
import { EmptyState } from '../../../components/ui/EmptyState';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { ArrowUpRightIcon } from '../../../components/icons';
import type { SummaryDto } from '../../../api/models';
import { modelColor } from '../../../lib/colors';
import { fmtTokens } from '../../../lib/format';
import type { RangeKey } from '../../../lib/time-range';
import { RANGES, splitTokenStr, type ModelSplit } from '../dashboardMeta';

interface HeroTokenCardProps {
  summary: SummaryDto | undefined;
  tokenVolume: number[];
  modelSplit: ModelSplit;
  range: RangeKey;
  onRangeChange: (r: RangeKey) => void;
}

export function HeroTokenCard({ summary, tokenVolume, modelSplit, range, onRangeChange }: HeroTokenCardProps) {
  const totalTokens = (summary?.totalInputTokens ?? 0) + (summary?.totalOutputTokens ?? 0);
  const { num: tokenNum, suffix: tokenSuffix } = splitTokenStr(totalTokens);

  return (
    <div data-testid="hero-token-card" className="relative overflow-hidden rounded-lg bg-card px-4 pt-3 pb-3.5 flex flex-col gap-2.5 shadow-[var(--shadow-card)]">
      <div className="absolute -top-20 -left-16 w-[420px] h-[280px] pointer-events-none bg-[radial-gradient(ellipse,var(--accent-subtle),transparent_70%)]" />
      <div className="absolute -bottom-24 -right-16 w-[380px] h-[260px] pointer-events-none bg-[radial-gradient(ellipse,color-mix(in_srgb,var(--teal)_6%,transparent),transparent_70%)]" />

      {/* Header: value + range picker */}
      <div className="relative flex items-start justify-between">
        <div>
          <div className="text-[9px] text-muted tracking-[0.16em] uppercase font-bold font-mono mb-1">
            Token Volume · rolling {range}
          </div>
          <div className="flex items-baseline gap-2.5 flex-wrap">
            <span
              data-testid="hero-token-total"
              data-token-total={totalTokens}
              className="text-[44px] font-extrabold tracking-[-0.04em] leading-[0.92] text-primary tabular-nums"
            >
              {tokenNum}<span className="text-accent">{tokenSuffix}</span>
            </span>
            <span className="inline-flex items-center gap-[3px] text-body-sm font-bold text-success px-2 py-[3px] bg-success-subtle rounded-full">
              <ArrowUpRightIcon size={11} /> +12%
            </span>
          </div>
          <div className="mt-1.5 flex gap-2.5 text-[10.5px] font-mono text-muted items-center flex-wrap">
            <span><span className="text-secondary font-semibold">{(summary?.totalInputTokens ?? 0).toLocaleString()}</span> in</span>
            <span className="text-border">/</span>
            <span><span className="text-secondary font-semibold">{(summary?.totalOutputTokens ?? 0).toLocaleString()}</span> out</span>
            <span className="text-border">/</span>
            <span><span className="text-secondary font-semibold">{(summary?.totalCalls ?? 0).toLocaleString()}</span> traces</span>
          </div>
        </div>
        <SegmentedControl
          value={range}
          onChange={onRangeChange}
          segments={RANGES.map(r => ({ value: r, label: r }))}
        />
      </div>

      {/* Area chart */}
      <div className="relative -mx-2">
        {tokenVolume.length >= 2 ? (
          <AreaChart
            data={tokenVolume}
            height={120}
            color="var(--accent-primary)"
            gradientId="heroVolGrad"
            showAxis={false}
            formatValue={v => `${fmtTokens(v)} tokens`}
          />
        ) : (
          <div className="h-[120px] flex items-center justify-center">
            <EmptyState title="No token data yet" description="Volume appears once traces are captured." />
          </div>
        )}
      </div>

      {/* Model split */}
      <div className="relative flex flex-col gap-[5px] pt-2 border-t border-border-subtle">
        <div className="flex items-center justify-between">
          <div className="text-caption text-muted tracking-[0.14em] uppercase font-mono font-bold">Split by model</div>
          <div className="text-[10.5px] text-muted font-mono">{modelSplit.models.length} active</div>
        </div>
        {modelSplit.models.length > 0 ? (
          <>
            <div className="flex h-2.5 rounded-sm overflow-hidden gap-0.5">
              {modelSplit.models.map(m => (
                <div
                  key={m.name}
                  title={`${m.name}: ${fmtTokens(m.tokens)} tokens (${Math.round((m.tokens / modelSplit.total) * 100)}%)`}
                  style={{ flexGrow: m.tokens / modelSplit.total, background: modelColor(m.name) }}
                />
              ))}
            </div>
            <div className="flex gap-[18px] text-body-sm font-mono flex-wrap">
              {modelSplit.models.map(m => (
                <span key={m.name} className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-sm" style={{ background: modelColor(m.name) }} />
                  <span className="text-secondary">{m.name}</span>
                  <span className="text-muted">· {fmtTokens(m.tokens)}</span>
                </span>
              ))}
            </div>
          </>
        ) : (
          <div className="text-body-sm text-muted font-mono py-1">No model activity in range.</div>
        )}
      </div>
    </div>
  );
}
