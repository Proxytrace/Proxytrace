import { useMessage } from '@assistant-ui/react';
import { Trans, useLingui } from '@lingui/react/macro';
import { AlertTriangleIcon, ClockIcon, CoinsIcon } from '../../../components/icons';
import { fmtLatency, fmtTokens } from '../../../lib/format';
import { readMessageStats, readTraceConversationId } from '../message-stats';
import { useOpenResponseTrace } from '../useOpenResponseTrace';
import { CopyMessageButton } from './CopyMessageButton';
import { OpenTraceButton } from './OpenTraceButton';

/**
 * A quiet status row beneath a finished Tracey response: the turn's total tokens + duration (read
 * straight from the assistant message metadata, attached on finish by {@link TraceyTransport} from
 * the SDK's per-turn usage aggregate), a copy-to-clipboard action, and a deep-link to the captured
 * trace(s). Hidden while the turn is still streaming (metadata is attached only on finish).
 */
export function MessageStatusBar() {
  const { t } = useLingui();
  // `metadata.custom` is a stable reference on the stored message, so selecting it (rather than a
  // freshly-derived object) keeps the selector snapshot stable.
  const custom = useMessage((m) => (m.role === 'assistant' ? m.metadata.custom : undefined));
  const text = useMessage((m) =>
    m.role === 'assistant' ? m.content.map((p) => (p.type === 'text' ? p.text : '')).join('').trim() : '',
  );
  const { openTrace } = useOpenResponseTrace();

  const conversationId = readTraceConversationId(custom?.traceConversationId);
  const stats = readMessageStats(custom);

  if (!conversationId) return null;

  return (
    <div data-testid="tracey-message-status" className="flex items-center gap-3 text-body-sm text-muted">
      {stats && (
        <div className="flex items-center gap-3">
          <span
            className="inline-flex items-center gap-1"
            title={t`Total tokens (input ${stats.inputTokens.toLocaleString()} · output ${stats.outputTokens.toLocaleString()})`}
          >
            <CoinsIcon size={12} strokeWidth={2.2} />
            <span className="font-mono">{fmtTokens(stats.totalTokens)}</span>
          </span>
          {stats.durationMs != null && (
            <span className="inline-flex items-center gap-1" title={t`Response time`}>
              <ClockIcon size={12} strokeWidth={2.2} />
              <span className="font-mono">{fmtLatency(stats.durationMs)}</span>
            </span>
          )}
          {stats.stoppedEarly && (
            <span
              data-testid="tracey-step-limit"
              className="inline-flex items-center gap-1 text-warn"
              title={t`The turn hit its tool-step budget before Tracey could answer. Ask her to continue.`}
            >
              <AlertTriangleIcon size={12} strokeWidth={2.2} />
              <Trans>Step limit reached</Trans>
            </span>
          )}
        </div>
      )}
      <div className="flex items-center gap-0.5">
        {text.length > 0 && <CopyMessageButton text={text} />}
        <OpenTraceButton onClick={() => openTrace(conversationId)} />
      </div>
    </div>
  );
}
