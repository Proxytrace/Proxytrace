import type { PlaygroundStats } from '../state/types';

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

export function CompletionStats({ stats, streaming }: Props) {
  if (streaming) {
    return (
      <div className="flex items-center gap-2 text-[11px] text-muted font-mono">
        <span className="size-[6px] rounded-full bg-emerald-400 pulse-dot" />
        Streaming…
      </div>
    );
  }
  if (!stats) return null;
  return (
    <div className="flex items-center gap-3 text-[11px] font-mono text-secondary">
      <span><span className="text-muted">in</span> {fmt(stats.inputTokens)}</span>
      <span><span className="text-muted">out</span> {fmt(stats.outputTokens)}</span>
      <span><span className="text-muted">latency</span> {fmt(stats.latencyMs)}ms</span>
      <span><span className="text-muted">cost</span> {fmtCost(stats.costEur)}</span>
      {stats.finishReason && (
        <span><span className="text-muted">finish</span> {stats.finishReason}</span>
      )}
    </div>
  );
}
