import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { TestRunEvent, TestRunGroupDto } from '../../../api/models';
import { QUERY_KEYS } from '../../../api/query-keys';
import { useTestRunGroupStream } from '../../../api/event-stream';
import { patchGroupRunStatus, patchGroupWithResult } from '../results';
import { emptyLiveProgress, reduceLiveProgress, type LiveProgress } from '../live';

/** Folds one already-buffered event into the cached group (finalized result or per-run status). */
function applyToCache(group: TestRunGroupDto, e: TestRunEvent): TestRunGroupDto {
  if (e.type === 'test-result-arrived') return patchGroupWithResult(group, e);
  if (e.type === 'run-complete') return patchGroupRunStatus(group, e);
  return group;
}

/**
 * Single source of truth for a group's live state while it runs. Subscribes to the group SSE
 * stream (only while `active`) and:
 *  - folds every event into an ephemeral in-flight {@link LiveProgress} map (per-evaluator
 *    progress for cases that have no finalized result yet), returned to the caller;
 *  - patches the selected group's *detail* cache in place — finalized results and per-run
 *    completion — so the detail view never refetches mid-run (BEST_PRACTICES §3.2). The patch
 *    no-ops until the fat group has resolved (an SSE event may arrive before the GET);
 *  - on the terminal `group-run-complete`, clears the live map and invalidates the whole
 *    `test-run-groups` cache once (detail + the light list, by prefix), healing both the matrix and
 *    the left-rail pass rates and any events the bounded SSE channel may have dropped under load.
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
      qc.setQueryData<TestRunGroupDto>(
        QUERY_KEYS.testRunGroup(groupId),
        group => (group ? events.reduce(applyToCache, group) : group),
      );
    }
  }, [qc, groupId]);

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
    void qc.invalidateQueries({ queryKey: QUERY_KEYS.testRunSchedulesRoot });
  }, [qc]);

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
  }, []);

  useTestRunGroupStream(active ? groupId : null, handleEvent, handleDone);

  return live;
}
