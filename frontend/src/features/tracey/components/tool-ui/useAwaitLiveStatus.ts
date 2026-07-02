import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '../../../../api/query-keys';
import { testRunGroupsApi } from '../../../../api/test-run-groups';
import { theoriesApi } from '../../../../api/theories';
import type { TestRunGroupDto, TheoryDto } from '../../../../api/models';

/**
 * Live status for one awaited handle while `await_actions` is still polling — as a **passive
 * mirror of the shared query cache**, never a fetcher of its own (`enabled: false`):
 *
 * - In the standard turn the producing live card (`LiveRunCard` / `LiveTheoryCard`) is mounted in
 *   the same thread, owns the fetch, and patches this exact canonical key via SSE — the await row
 *   re-renders on those patches for free.
 * - Fetching here too would double every request the tool's own 3 s poll already makes, race
 *   stale poll responses against newer SSE patches (progress jumping backwards), keep hammering a
 *   handle the tool has already given up on, and fire GETs for partially-streamed ids while the
 *   model is still emitting the tool args.
 * - The app-wide query default is `throwOnError: true`; these rows must never take down the page
 *   over a bad handle, hence the explicit opt-out.
 *
 * When no live card ever populated the key (an await without a producing card in view) the row
 * simply keeps its compact id fallback — the tool's result still lands when the wait resolves.
 * The `queryFn`s match the live cards' exactly so sharing the key never changes fetch behavior.
 */
export function useAwaitRunSnapshot(id: string): TestRunGroupDto | undefined {
  const query = useQuery({
    queryKey: QUERY_KEYS.testRunGroup(id),
    queryFn: () => testRunGroupsApi.get(id),
    enabled: false,
    throwOnError: false,
  });
  return query.data;
}

/** Theory counterpart of {@link useAwaitRunSnapshot} — same passive-mirror contract. */
export function useAwaitTheorySnapshot(id: string): TheoryDto | undefined {
  const query = useQuery({
    queryKey: QUERY_KEYS.theory(id),
    queryFn: () => theoriesApi.get(id),
    enabled: false,
    throwOnError: false,
  });
  return query.data;
}
