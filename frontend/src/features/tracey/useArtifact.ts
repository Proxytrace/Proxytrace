import { useQuery } from '@tanstack/react-query';
import { getArtifact } from './tracey-artifact-store';
import type { ToolUIState } from './components/tool-ui/tool-ui-state';

/** The reference id carried by a store-backed tool result, or undefined for an inline result. */
function artifactRefOf(result: unknown): string | undefined {
  if (result && typeof result === 'object' && 'artifactRef' in result) {
    const ref = (result as { artifactRef: unknown }).artifactRef;
    return typeof ref === 'string' ? ref : undefined;
  }
  return undefined;
}

/**
 * Resolves a Tracey tool-call part into a render state plus the full payload to display. Store-backed
 * tools return only a reference; this hook fetches the full payload from the browser artifact store
 * (the data never enters the model context). Inline results (e.g. a `notFound` object) pass straight
 * through. The returned state folds together the tool-call lifecycle and the artifact fetch so cards
 * keep their single pending/error/ready handling.
 */
export function useArtifactResult<T>(
  result: unknown,
  status: { type: string },
  isError: boolean | undefined,
): { state: ToolUIState; data: T | undefined } {
  const ref = artifactRefOf(result);
  const query = useQuery({
    queryKey: ['tracey-artifact', ref],
    queryFn: () => getArtifact(ref ?? ''),
    enabled: !!ref,
    staleTime: Infinity,
  });

  if (isError || status.type === 'incomplete') return { state: 'error', data: undefined };
  if (result == null) return { state: 'pending', data: undefined };
  // Inline (non-reference) result: nothing to fetch.
  if (!ref) return { state: 'ready', data: result as T };
  if (query.isPending) return { state: 'pending', data: undefined };
  if (query.isError || query.data == null) return { state: 'error', data: undefined };
  return { state: 'ready', data: query.data as T };
}
