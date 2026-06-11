import { useQuery } from '@tanstack/react-query';
import { getArtifact } from './tracey-artifact-store';
import type { ArtifactKind, ArtifactPayloads } from './tracey-artifact-kinds';
import type { ToolUIState } from './components/tool-ui/tool-ui-state';

/**
 * The envelope fields of a store-backed tool result, or undefined for an inline result. The
 * `kind` rides along so the card can verify it is resolving the artifact shape it expects.
 */
export function artifactEnvelopeOf(result: unknown): { ref: string; kind: string } | undefined {
  if (result && typeof result === 'object' && 'artifactRef' in result) {
    const { artifactRef, kind } = result as { artifactRef: unknown; kind?: unknown };
    if (typeof artifactRef === 'string') {
      return { ref: artifactRef, kind: typeof kind === 'string' ? kind : '' };
    }
  }
  return undefined;
}

/**
 * Resolves a Tracey tool-call part into a render state plus the full payload to display. Store-backed
 * tools return only a reference; this hook fetches the full payload from the browser artifact store
 * (the data never enters the model context). Inline results (e.g. a `notFound` object) pass straight
 * through. The returned state folds together the tool-call lifecycle and the artifact fetch so cards
 * keep their single pending/error/ready handling.
 *
 * `kind` binds the returned data to {@link ArtifactPayloads} — the same contract `StoreFn` enforces
 * on the tool side — and is verified against the envelope at runtime, so a card asking for a kind
 * its tool didn't store renders the error state instead of crashing on a mismatched shape.
 */
export function useArtifactResult<K extends ArtifactKind>(
  kind: K,
  result: unknown,
  status: { type: string },
  isError: boolean | undefined,
): { state: ToolUIState; data: ArtifactPayloads[K] | undefined } {
  const envelope = artifactEnvelopeOf(result);
  const ref = envelope?.ref;
  const query = useQuery({
    queryKey: ['tracey-artifact', ref],
    queryFn: () => getArtifact(ref ?? ''),
    enabled: !!ref,
    staleTime: Infinity,
  });

  if (isError || status.type === 'incomplete') return { state: 'error', data: undefined };
  if (result == null) return { state: 'pending', data: undefined };
  // A by-id tool answers a 404 with the compact `{ notFound: id }` — there is no payload to
  // render, so every card uniformly shows its error state.
  if (typeof result === 'object' && 'notFound' in result) return { state: 'error', data: undefined };
  // Inline (non-reference) result: nothing to fetch. (The last-resort store-unavailable path —
  // the payload itself — also lands here; it carries no envelope kind to verify.)
  if (!envelope) return { state: 'ready', data: result as ArtifactPayloads[K] };
  // A kind mismatch means the card and its tool disagree about the payload shape — fail the
  // card visibly rather than crash rendering a shape it doesn't understand.
  if (envelope.kind !== kind) return { state: 'error', data: undefined };
  if (query.isPending) return { state: 'pending', data: undefined };
  if (query.isError || query.data == null) return { state: 'error', data: undefined };
  return { state: 'ready', data: query.data as ArtifactPayloads[K] };
}
