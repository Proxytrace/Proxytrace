import { Pill } from '../../../components/ui/Pill';
import { StatusDot } from '../../../components/ui/StatusDot';
import { modelColor } from '../../../lib/colors';
import { fmtRelative } from '../../../lib/format';
import { cn } from '../../../lib/cn';
import type { AgentCallListItemDto } from '../../../api/models';
import { GRID_TEMPLATE, toolCount } from '../tracesMeta';
import { MessagePreviewCell, TokenCell, ToolsCell, LatencyCell } from './TraceTableCells';

interface Props {
  trace: AgentCallListItemDto;
  selected: boolean;
  onClick: () => void;
}

export function FlatTraceRow({ trace, selected, onClick }: Props) {
  return (
    <div
      role="row"
      data-trace-id={trace.id}
      data-testid={`trace-row-${trace.id}`}
      onClick={onClick}
      className={cn(
        'grid items-center px-4 py-[10px] min-h-[44px] cursor-pointer transition-colors duration-[100ms]',
        'border-b border-b-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.025)]',
        selected && 'bg-[rgba(255,255,255,0.04)]',
      )}
      style={{ gridTemplateColumns: GRID_TEMPLATE }}
    >
      <MessagePreviewCell trace={trace} />
      <span className="text-body text-secondary overflow-hidden text-ellipsis whitespace-nowrap pr-2">
        {trace.agentName ?? <span className="text-muted">—</span>}
      </span>
      <span className="overflow-hidden">
        <Pill label={trace.model} color={modelColor(trace.model)} size="sm" />
      </span>
      <StatusDot httpStatus={trace.httpStatus} />
      <ToolsCell count={toolCount(trace)} />
      <TokenCell trace={trace} />
      <LatencyCell ms={trace.durationMs} />
      <span className="text-muted text-body-sm whitespace-nowrap text-right">{fmtRelative(trace.createdAt)}</span>
    </div>
  );
}
