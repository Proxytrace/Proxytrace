import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTraceStream } from '../../../api/event-stream';

/**
 * Subscribes to the trace SSE stream and invalidates the agent-calls and
 * statistics-agent-breakdown caches when a new trace arrives.
 *
 * NOTE: The TraceCreatedEvent only carries partial data (id, agentId, model,
 * provider, createdAt) — not the full AgentCallDto needed for a setQueryData
 * cache patch. Full cache patching would require a separate GET per event.
 * Invalidation (triggering a refetch) is therefore the correct approach here.
 * This is a known deviation from BEST_PRACTICES §3.2 "SSE patches the cache";
 * fixing it properly requires either a richer SSE event or a per-trace fetch
 * on arrival, which is tracked as a future improvement.
 */
export function useTraceSseStream() {
  const qc = useQueryClient();

  const handleTrace = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['agent-calls'] });
    qc.invalidateQueries({ queryKey: ['statistics-agent-breakdown'] });
  }, [qc]);

  useTraceStream(handleTrace);
}
