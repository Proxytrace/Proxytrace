import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { PagedResult, TestRunGroupDto, TestRunEvent } from '../../api/models';
import { QUERY_KEYS } from '../../api/query-keys';
import { useTestRunGroupStream } from '../../api/event-stream';
import { isActive, patchGroupsWithResult } from './results';
import { useCancelTestRunGroup } from './hooks/useCancelTestRunGroup';
import { RunGroupHeader } from './components/RunGroupHeader';
import { ModelLeaderboard } from './components/ModelLeaderboard';
import { EvaluatorHeatmap } from './components/EvaluatorHeatmap';
import { MatrixView } from './MatrixView';

export function GroupDetail({ group, onDelete }: { group: TestRunGroupDto; onDelete: () => void }) {
  const qc = useQueryClient();
  const [activeCaseIds, setActiveCaseIds] = useState<Set<string>>(new Set());
  const active = group.runs.some(r => isActive(r.status));

  const invalidateGroups = useCallback(
    () => qc.invalidateQueries({ queryKey: QUERY_KEYS.testRunGroupsRoot }),
    [qc],
  );

  const cancelGroup = useCancelTestRunGroup(group.id);

  // Live updates flow through SSE: patch the cached group list in place — no refetch.
  const handleStreamEvent = useCallback((e: TestRunEvent) => {
    if (e.type === 'test-case-started') {
      setActiveCaseIds(prev => new Set([...prev, e.testCaseId]));
    } else if (e.type === 'test-result-arrived') {
      setActiveCaseIds(prev => { const next = new Set(prev); next.delete(e.testCaseId); return next; });
      qc.setQueriesData<PagedResult<TestRunGroupDto>>(
        { queryKey: QUERY_KEYS.testRunGroupsRoot },
        page => (page ? patchGroupsWithResult(page, e) : page),
      );
    }
  }, [qc]);

  const handleStreamDone = useCallback(() => {
    setActiveCaseIds(new Set());
    invalidateGroups();
  }, [invalidateGroups]);

  useTestRunGroupStream(active ? group.id : null, handleStreamEvent, handleStreamDone);

  const multipleRuns = group.runs.length > 1;

  // Single- and multi-endpoint groups render identically: the matrix is the
  // canonical results view (one column per endpoint). The matrix is the only
  // scroller, so this column fills the viewport and never spills a page scrollbar.
  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      <RunGroupHeader
        group={group}
        onDelete={onDelete}
        onCancel={() => cancelGroup.mutate()}
        cancelPending={cancelGroup.isPending}
      />

      {multipleRuns && <ModelLeaderboard runs={group.runs} />}

      <EvaluatorHeatmap group={group} />

      <MatrixView group={group} activeCaseIds={activeCaseIds} />
    </div>
  );
}
