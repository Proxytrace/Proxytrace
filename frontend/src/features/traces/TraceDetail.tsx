import type { AgentCallDto, MessageDto } from '../../api/models';
import { Drawer } from '../../components/overlays/Drawer';
import { CodeBlock } from '../../components/ui/CodeBlock';
import { Pill } from '../../components/ui/Pill';
import { StatusDot } from '../../components/ui/StatusDot';
import { modelColor } from '../../lib/colors';
import { fmtDate, fmtDuration, fmtTokens } from '../../lib/format';

interface Props {
  trace: AgentCallDto;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}

function msgContent(msg: MessageDto): string {
  if (msg.content) return msg.content;
  if (msg.toolRequests?.length) return JSON.stringify(msg.toolRequests, null, 2);
  return '';
}

export function TraceDetail({ trace, onClose, onPrev, onNext }: Props) {
  return (
    <Drawer
      title={`Trace ${trace.id.slice(0, 8)}…`}
      subtitle={`${trace.model} · ${fmtDate(trace.createdAt)}`}
      onClose={onClose}
      onPrev={onPrev}
      onNext={onNext}
    >
      {/* Meta row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Pill label={trace.model} color={modelColor(trace.model)} />
        <StatusDot httpStatus={trace.httpStatus} />
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtTokens(trace.inputTokens)} in · {fmtTokens(trace.outputTokens)} out</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtDuration(trace.durationMs)}</span>
        {trace.finishReason && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{trace.finishReason}</span>}
      </div>

      {trace.errorMessage && (
        <div style={{ padding: '10px 14px', background: 'rgba(217,85,85,0.08)', border: '1px solid rgba(217,85,85,0.2)', borderRadius: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--danger)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Error</div>
          <div style={{ fontSize: 13, color: 'var(--danger)' }}>{trace.errorMessage}</div>
        </div>
      )}

      {/* Request messages */}
      {trace.request.map((msg, i) => (
        <CodeBlock
          key={i}
          heading={`${msg.role.toUpperCase()} (request)`}
          content={msgContent(msg)}
          maxLines={12}
        />
      ))}

      {/* Response */}
      {trace.response && (
        <CodeBlock
          heading={`${trace.response.role.toUpperCase()} (response)`}
          content={msgContent(trace.response)}
          maxLines={20}
        />
      )}

      {/* Cost */}
      {trace.costEur != null && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Cost: €{trace.costEur.toFixed(6)}
        </div>
      )}
    </Drawer>
  );
}
