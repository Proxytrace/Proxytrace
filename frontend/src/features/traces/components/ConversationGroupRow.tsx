import { Pill } from '../../../components/ui/Pill';
import { StatusDot } from '../../../components/ui/StatusDot';
import { agentColor, modelColor } from '../../../lib/colors';
import { fmtTokens, fmtRelative } from '../../../lib/format';
import { cn } from '../../../lib/cn';
import type { AgentCallDto } from '../../../api/models';
import { GRID_TEMPLATE } from '../tracesMeta';
import type { ConversationGroup } from '../tracesMeta';
import { MiniChevronIcon } from '../../../components/icons';
import { TokenCell, ToolsCell, LatencyCell } from './TraceTableCells';

interface Props {
  group: ConversationGroup;
  expanded: boolean;
  onToggle: () => void;
  selectedId: string | null;
  onSelectTrace: (trace: AgentCallDto) => void;
}

export function ConversationGroupRow({ group, expanded, onToggle, selectedId, onSelectTrace }: Props) {
  const { turns, conversationId } = group;
  const totalTokens = turns.reduce((n, t) => n + t.inputTokens + t.outputTokens, 0);
  const totalMs = turns.reduce((n, t) => n + t.durationMs, 0);
  const totalTools = turns.reduce((n, t) => n + t.response.toolRequests.length, 0);
  const agentName = turns[0].agentName;
  const model = turns[0].model;
  const c = turns[0].agentId ? agentColor(turns[0].agentId) : agentColor(conversationId);
  const allOk = turns.every(t => t.httpStatus >= 200 && t.httpStatus < 300);

  return (
    <>
      {/* Header row */}
      <div
        role="row"
        data-testid={`conversation-group-row-${conversationId}`}
        onClick={onToggle}
        className="grid items-center px-4 py-[10px] min-h-[44px] cursor-pointer transition-colors duration-[100ms] border-b border-b-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.025)] bg-[rgba(255,255,255,0.015)]"
        style={{ gridTemplateColumns: GRID_TEMPLATE }}
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className="w-[3px] h-[18px] rounded-[2px] shrink-0" style={{ background: c }} />
          <span className="mono text-body-sm text-accent">{conversationId.slice(0, 8)}…</span>
          <span
            className="inline-flex items-center gap-[3px] text-caption font-semibold px-[5px] py-[1px] rounded-full"
            style={{ background: `color-mix(in srgb, ${c} 14%, transparent)`, color: c }}
          >
            {turns.length} turns
            <MiniChevronIcon
              className={cn('shrink-0 transition-transform duration-[150ms]', expanded ? 'rotate-90' : 'rotate-0')}
            />
          </span>
        </span>

        <span className="text-body text-secondary overflow-hidden text-ellipsis whitespace-nowrap pr-2">
          {agentName ?? <span className="text-muted">—</span>}
        </span>

        <span className="overflow-hidden">
          <Pill label={model} color={modelColor(model)} size="sm" />
        </span>

        <span className="inline-flex items-center gap-[5px]">
          {allOk
            ? <><StatusDot httpStatus={200} showLabel={false} /><span className="mono text-body-sm text-success">2xx</span></>
            : <><StatusDot httpStatus={500} showLabel={false} /><span className="mono text-body-sm text-warn">mixed</span></>}
        </span>

        <ToolsCell count={totalTools} />

        <span className="mono text-body-sm">
          <span className="text-primary">{fmtTokens(totalTokens)}</span>
          <span className="text-muted ml-[5px] text-caption">total</span>
        </span>

        <LatencyCell ms={totalMs} />

        <span className="text-muted text-body-sm whitespace-nowrap text-right">{fmtRelative(turns[0].createdAt)}</span>
      </div>

      {/* Child turn rows */}
      {expanded && turns.map((turn, i) => (
        <div
          key={turn.id}
          role="row"
          data-trace-id={turn.id}
          data-testid={`conversation-turn-${turn.id}`}
          onClick={() => onSelectTrace(turn)}
          className={cn(
            'grid items-center pl-8 pr-4 py-[10px] min-h-[44px] cursor-pointer transition-colors duration-[100ms]',
            'border-b border-b-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.025)]',
            turn.id === selectedId && 'bg-[rgba(255,255,255,0.04)]',
          )}
          style={{ gridTemplateColumns: GRID_TEMPLATE, borderLeft: `2px solid color-mix(in srgb, ${c} 38%, transparent)` }}
        >
          <span className="flex items-center gap-2 min-w-0">
            <span className="mono text-caption text-muted shrink-0">Turn {turns.length - i}</span>
            <span className="mono text-primary text-body-sm">{turn.id.slice(0, 8)}…{turn.id.slice(-4)}</span>
          </span>
          <span className="text-body text-secondary overflow-hidden text-ellipsis whitespace-nowrap pr-2">
            {turn.agentName ?? <span className="text-muted">—</span>}
          </span>
          <span className="overflow-hidden">
            <Pill label={turn.model} color={modelColor(turn.model)} size="sm" />
          </span>
          <StatusDot httpStatus={turn.httpStatus} />
          <ToolsCell count={turn.response.toolRequests.length} />
          <TokenCell trace={turn} />
          <LatencyCell ms={turn.durationMs} />
          <span className="text-muted text-body-sm whitespace-nowrap text-right">{fmtRelative(turn.createdAt)}</span>
        </div>
      ))}
    </>
  );
}
