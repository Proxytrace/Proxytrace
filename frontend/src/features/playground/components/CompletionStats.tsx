import { ArrowDownToLineIcon, ArrowUpFromLineIcon, ClockIcon, CoinsIcon, CheckIcon } from '../../../components/icons';
import type { PlaygroundStats } from '../state/types';
import { KpiCell } from './KpiCell';

interface Props {
  stats: PlaygroundStats | null;
  streaming: boolean;
}

function fmt(n: number) {
  return n.toLocaleString();
}

function fmtCost(eur: number | null) {
  if (eur == null) return '—';
  if (eur < 0.0001) return '< €0.0001';
  return `€${eur.toFixed(4)}`;
}

function fmtLatency(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function latencyTone(ms: number) {
  if (ms < 1000) return 'good' as const;
  if (ms < 3000) return 'neutral' as const;
  return 'warn' as const;
}

function costTone(eur: number | null) {
  if (eur == null) return 'neutral' as const;
  if (eur < 0.001) return 'good' as const;
  if (eur < 0.05) return 'neutral' as const;
  return 'warn' as const;
}

function finishTone(reason: string | null | undefined) {
  if (!reason) return 'neutral' as const;
  if (reason === 'stop' || reason === 'tool_calls') return 'good' as const;
  if (reason === 'length' || reason === 'content_filter') return 'warn' as const;
  return 'neutral' as const;
}

export function CompletionStats({ stats, streaming }: Props) {
  // Render placeholder cells if no stats yet
  if (!stats && !streaming) {
    return (
      <div className="flex items-center gap-[6px] text-[11px] text-muted italic">
        Send a message to see completion metrics.
      </div>
    );
  }

  const inT = stats?.inputTokens ?? 0;
  const outT = stats?.outputTokens ?? 0;
  const lat = stats?.latencyMs ?? 0;
  const cost = stats?.costEur ?? null;

  return (
    <div className="flex items-center gap-[6px] flex-wrap">
      <KpiCell
        icon={<ArrowDownToLineIcon size={13} strokeWidth={2.2} />}
        label="Input"
        value={stats ? fmt(inT) : '…'}
        tooltip="Input tokens (prompt)"
      />
      <KpiCell
        icon={<ArrowUpFromLineIcon size={13} strokeWidth={2.2} />}
        label="Output"
        value={stats ? fmt(outT) : '…'}
        tooltip="Output tokens (generated)"
      />
      <KpiCell
        icon={<ClockIcon size={13} strokeWidth={2.2} />}
        label="Latency"
        value={stats ? fmtLatency(lat) : '…'}
        tone={stats ? latencyTone(lat) : 'neutral'}
        tooltip="End-to-end latency"
      />
      <KpiCell
        icon={<CoinsIcon size={13} strokeWidth={2.2} />}
        label="Cost"
        value={fmtCost(cost)}
        tone={costTone(cost)}
        tooltip="Estimated cost in EUR"
      />
      {streaming ? (
        <KpiCell
          icon={<span className="size-[7px] rounded-full bg-accent pulse-dot" />}
          label="Status"
          value="Streaming…"
          tone="live"
          tooltip="Receiving tokens"
        />
      ) : (
        <KpiCell
          icon={<CheckIcon size={13} strokeWidth={2.4} />}
          label="Finish"
          value={stats?.finishReason ?? '—'}
          tone={finishTone(stats?.finishReason)}
          tooltip="Finish reason returned by the model"
        />
      )}
    </div>
  );
}
