import { useMessage } from '@assistant-ui/react';
import { ActivityIcon } from '../../../components/icons';
import { useOpenResponseTrace } from '../useOpenResponseTrace';

/** Narrows the message metadata value (typed `unknown`) to the turn's correlation id. */
function readTraceConversationId(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/**
 * A small action under a completed Tracey response that opens the trace her turn was ingested as.
 * The turn's correlation id rides on the assistant message metadata (`metadata.custom`, set by
 * {@link TraceyTransport}); {@link useOpenResponseTrace} resolves it to the trace. Renders nothing
 * while a turn is still streaming (no id yet).
 */
export function TraceLink() {
  const conversationId = useMessage((m) =>
    m.role === 'assistant' ? readTraceConversationId(m.metadata.custom?.traceConversationId) : undefined,
  );
  const { openTrace, isOpening } = useOpenResponseTrace();

  if (!conversationId) return null;

  return (
    <button
      type="button"
      onClick={() => openTrace(conversationId)}
      disabled={isOpening}
      aria-label="View ingested trace"
      title="View ingested trace"
      data-testid="tracey-trace-link"
      className="inline-flex size-6 items-center justify-center self-start rounded-md text-muted transition-colors hover:text-primary disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent-primary)_60%,transparent)] cursor-pointer"
    >
      <ActivityIcon size={14} />
    </button>
  );
}
