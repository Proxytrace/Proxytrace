import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '../../../../api/query-keys';
import { testRunGroupsApi } from '../../../../api/test-run-groups';
import { theoriesApi } from '../../../../api/theories';
import type { TestRunGroupDto, TheoryDto } from '../../../../api/models';
import type { AwaitKind } from '../../tools/await';

/** Matches the wait tool's own poll cadence (`POLL_INTERVAL_MS` in `tools/await.ts`). */
const AWAIT_STATUS_POLL_MS = 3_000;

/**
 * Live status for one awaited handle while `await_actions` is still polling: the card mirrors the
 * backend state (suite/agent names, case progress, theory phase) instead of showing a bare id. It
 * shares the entity's canonical query key, so the live run/theory cards and any SSE patches feed
 * the same cache; polling stops when the row unmounts (the wait resolved) or `enabled` drops.
 * A 404 is silent — a bad handle just keeps its compact id row, mirroring the tool's own polling.
 */
export function useAwaitLiveStatus(
  kind: AwaitKind,
  id: string,
  enabled: boolean,
): { group?: TestRunGroupDto; theory?: TheoryDto } {
  const groupQuery = useQuery({
    queryKey: QUERY_KEYS.testRunGroup(id),
    queryFn: () => testRunGroupsApi.get(id, { silentStatuses: [404] }),
    enabled: enabled && kind === 'test-run',
    refetchInterval: AWAIT_STATUS_POLL_MS,
  });
  const theoryQuery = useQuery({
    queryKey: QUERY_KEYS.theory(id),
    queryFn: () => theoriesApi.get(id, { silentStatuses: [404] }),
    enabled: enabled && kind === 'theory',
    refetchInterval: AWAIT_STATUS_POLL_MS,
  });
  return {
    group: kind === 'test-run' ? groupQuery.data : undefined,
    theory: kind === 'theory' ? theoryQuery.data : undefined,
  };
}
