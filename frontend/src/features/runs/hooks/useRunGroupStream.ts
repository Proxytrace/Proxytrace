import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { PagedResult, TestRunEvent, TestRunGroupDto } from '../../../api/models';
import { QUERY_KEYS } from '../../../api/query-keys';
import { useTestRunGroupStream } from '../../../api/event-stream';
import { patchGroupsRunStatus, patchGroupsWithResult } from '../results';
import { emptyLiveProgress, reduceLiveProgress, type LiveProgress } from '../live';

/** Folds one already-buffered event into a cached page (finalized result or per-run status). */
function applyToCache(page: PagedResult<TestRunGroupDto>, e: TestRunEvent): PagedResult<TestRunGroupDto> {
  if (e.type === 'test-result-arrived') return patchGroupsWithResult(page, e);
  if (e.type === 'run-complete') return patchGroupsRunStatus(page, e);
  return page;
}

/**
 * Single source of truth for a group's live state while it runs. Subscribes to the group SSE
 * stream (only while `active`) and:
 *  - folds every event into an ephemeral in-flight {@link LiveProgress} map (per-evaluator
 *    progress for cases that have no finalized result yet), returned to the caller;
 *  - patches the cached group list in place — finalized results and per-run completion — so the
 *    list never refetches mid-run (BEST_PRACTICES §3.2);
 *  - on the terminal `group-run-complete`, clears the live map and invalidates once, which also
 *    heals any events the bounded SSE channel may have dropped under load.
 *
 * Events are **coalesced per animation frame**: parallel runs/evaluators fire many events per
 * second, so applying each one synchronously made the grid re-render frantically. Buffering a
 * burst into one live update + one cache patch per frame keeps it smooth without losing data.
 */
export function useRunGroupStream(groupId: string, active: boolean): LiveProgress {
  const qc = useQueryClient();
  const [live, setLive] = useState<LiveProgress>(emptyLiveProgress);

  const liveRef = useRef<LiveProgress>(live);
  const pendingRef = useRef<TestRunEvent[]>([]);
  const frameRef = useRef<number | null>(null);

  const flush = useCallback(() => {
    frameRef.current = null;
    const events = pendingRef.current;
    if (events.length === 0) return;
    pendingRef.current = [];

    const nextLive = events.reduce(reduceLiveProgress, liveRef.current);
    if (nextLive !== liveRef.current) {
      liveRef.current = nextLive;
      setLive(nextLive);
    }

    if (events.some(e => e.type === 'test-result-arrived' || e.type === 'run-complete')) {
      qc.setQueriesData<PagedResult<TestRunGroupDto>>(
        { queryKey: QUERY_KEYS.testRunGroupsRoot },
        page => (page ? events.reduce(applyToCache, page) : page),
      );
    }
  }, [qc]);

  const handleEvent = useCallback((e: TestRunEvent) => {
    pendingRef.current.push(e);
    frameRef.current ??= requestAnimationFrame(flush);
  }, [flush]);

  const handleDone = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    pendingRef.current = [];
    liveRef.current = emptyLiveProgress();
    setLive(liveRef.current);
    void qc.invalidateQueries({ queryKey: QUERY_KEYS.testRunGroupsRoot });
  }, [qc]);

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
  }, []);

  useTestRunGroupStream(active ? groupId : null, handleEvent, handleDone);

  return live;
}
