// One row of the dashboard live trace stream — either a single trace or a
// collapsed multi-turn conversation summary. Clicking drills into the Traces tab.

import { Pill } from '../../../components/ui/Pill';
import { modelColor, statusColor } from '../../../lib/colors';
import { fmtLatency, fmtTokens } from '../../../lib/format';
import { firstUserMessage } from '../../../lib/trace';
import type { TraceRow } from '../../../lib/trace';

// Shared grid template — header row and every data row align to this. Columns are
// fixed-width (not auto) so the header grid and each row's grid compute identical
// tracks; auto tracks would size to each grid's own content and drift out of line.
// Columns: dot · message · turns · model · status · tokens · latency.
export const LIVE_STREAM_GRID = 'grid grid-cols-[14px_minmax(0,1fr)_64px_104px_56px_60px_64px] gap-5';

interface Props {
  row: TraceRow;
  freshIds: Set<string>;
  isLast: boolean;
  onSelect: (id: string) => void;
}

export function LiveStreamRow({ row, freshIds, isLast, onSelect }: Props) {
  const rowCls = `w-full text-left ${LIVE_STREAM_GRID} items-center py-[7px] px-1.5 font-mono text-body-sm cursor-pointer transition-colors hover:bg-[color-mix(in_srgb,var(--accent-primary)_4%,transparent)] ${isLast ? '' : 'border-b border-border-subtle'}`;

  if (row.type === 'flat') {
    const t = row.trace;
    const sc = statusColor(t.httpStatus);
    const isFresh = freshIds.has(t.id);
    return (
      <button
        data-testid={`live-trace-row-${t.id}`}
        onClick={() => onSelect(t.id)}
        className={`${rowCls} ${isFresh ? 'slide-in' : ''}`}
      >
        <span className="size-[7px] rounded-full" style={{ background: sc, boxShadow: isFresh ? `0 0 10px ${sc}` : undefined }} />
        <span className="font-sans text-secondary overflow-hidden text-ellipsis whitespace-nowrap pr-2">
          {firstUserMessage(t) ?? <span className="text-muted">—</span>}
        </span>
        <span className="text-muted text-center">—</span>
        <span className="justify-self-center"><Pill label={t.model} color={modelColor(t.model)} size="sm" /></span>
        <span className="text-[10.5px] font-semibold text-center" style={{ color: sc }}>{t.httpStatus}</span>
        <span className="text-secondary text-right min-w-[54px]">{fmtTokens(t.inputTokens + t.outputTokens)}</span>
        <span className="text-muted text-right min-w-[58px]">{fmtLatency(t.durationMs)}</span>
      </button>
    );
  }

  const { turns, conversationId } = row;
  const head = turns[0];
  const totalTokens = turns.reduce((n, t) => n + t.inputTokens + t.outputTokens, 0);
  const totalMs = turns.reduce((n, t) => n + t.durationMs, 0);
  const allOk = turns.every(t => t.httpStatus >= 200 && t.httpStatus < 300);
  const sc = allOk ? 'var(--success)' : 'var(--warn)';
  const isFresh = turns.some(t => freshIds.has(t.id));
  return (
    <button
      data-testid={`live-trace-group-${conversationId}`}
      onClick={() => onSelect(head.id)}
      className={`${rowCls} ${isFresh ? 'slide-in' : ''}`}
    >
      <span className="size-[7px] rounded-full" style={{ background: sc, boxShadow: isFresh ? `0 0 10px ${sc}` : undefined }} />
      <span className="font-sans text-secondary overflow-hidden text-ellipsis whitespace-nowrap pr-2">
        {firstUserMessage(head) ?? <span className="text-muted">—</span>}
      </span>
      <span className="justify-self-center inline-flex items-center text-caption font-semibold px-[5px] py-[1px] rounded-full text-accent bg-accent-subtle">
        {turns.length} turns
      </span>
      <span className="justify-self-center"><Pill label={head.model} color={modelColor(head.model)} size="sm" /></span>
      <span className="text-[10.5px] font-semibold text-center" style={{ color: sc }}>{allOk ? '2xx' : 'mixed'}</span>
      <span className="text-secondary text-right min-w-[54px]">{fmtTokens(totalTokens)}</span>
      <span className="text-muted text-right min-w-[58px]">{fmtLatency(totalMs)}</span>
    </button>
  );
}
