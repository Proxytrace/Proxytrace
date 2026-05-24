import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { PagedResult, TestRunGroupDto, TestRunEvent } from '../../api/models';
import { QUERY_KEYS } from '../../api/query-keys';
import { useTestRunGroupStream } from '../../api/event-stream';
import { agentColor, tint } from '../../lib/colors';
import { fmtRelative } from '../../lib/format';
import { TrashIcon } from '../../components/icons';
import { Card } from '../../components/ui/Card';
import { Pill } from '../../components/ui/Pill';
import { Button } from '../../components/ui/Button';
import { runStatusColor, isActive, patchGroupsWithResult } from './results';
import { useCancelTestRunGroup } from './hooks/useCancelTestRunGroup';
import { SegmentedToggle } from './components/SegmentedToggle';
import { EndpointCompareCard } from './components/EndpointCompareCard';
import { MatrixView } from './MatrixView';
import { RunDetail } from './RunDetail';

export function GroupDetail({ group, onDelete }: { group: TestRunGroupDto; onDelete: () => void }) {
  const qc = useQueryClient();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(group.runs[0]?.id ?? null);
  const [groupView, setGroupView] = useState<'compare' | 'single'>('compare');
  const [activeCaseIds, setActiveCaseIds] = useState<Set<string>>(new Set());
  const c = agentColor(group.agentId);
  const active = group.runs.some(r => isActive(r.status));
  const sc = runStatusColor(group.status);

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

  const selectedRun = group.runs.find(r => r.id === selectedRunId) ?? group.runs[0] ?? null;
  const multipleRuns = group.runs.length > 1;

  const openRun = (runId: string) => { setSelectedRunId(runId); setGroupView('single'); };

  return (
    <div className="flex flex-col gap-3">
      {/* Unified header */}
      <Card padding="none" accentBar={`linear-gradient(90deg, ${c}, ${tint(c, 28)})`}>
        <div className="px-[18px] py-3 flex items-center gap-3 flex-wrap">
          <div className="flex flex-col gap-[3px] min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-h1 font-bold tracking-[-0.01em] m-0 truncate">{group.suiteName}</h2>
              <Pill label={group.agentName} color={c} />
              <span className="px-[7px] py-[2px] rounded-full text-caption font-semibold shrink-0" style={{ background: tint(sc, 18), color: sc }}>{group.status}</span>
              {active && (
                <span className="inline-flex items-center gap-1.5 text-caption text-muted shrink-0">
                  <span className="pulse-dot w-[5px] h-[5px] rounded-full bg-accent inline-block" />
                  live
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-body-sm text-muted">
              <span className="mono">{group.id.slice(0, 8)}</span>
              <span>·</span>
              <span>{fmtRelative(group.createdAt)}</span>
              <span>·</span>
              <span>{group.runs.length} run{group.runs.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            {active && (
              <Button variant="secondary" size="sm" onClick={() => cancelGroup.mutate()} loading={cancelGroup.isPending}>Cancel</Button>
            )}
            <button onClick={onDelete} className="btn-icon btn-icon-danger" aria-label="Delete run group" title="Delete run group"><TrashIcon size={14} /></button>
          </div>
        </div>
      </Card>

      {/* Endpoint comparison strip (only when multiple runs) */}
      {multipleRuns && (
        <>
          <div className="flex gap-2.5 flex-wrap">
            {group.runs.map(run => (
              <EndpointCompareCard
                key={run.id}
                run={run}
                isSelected={groupView === 'single' && selectedRunId === run.id}
                onSelect={() => openRun(run.id)}
                activeCaseIds={selectedRunId === run.id ? activeCaseIds : undefined}
              />
            ))}
          </div>
          <div className="flex justify-end">
            <SegmentedToggle
              value={groupView}
              onChange={setGroupView}
              segments={[{ value: 'compare', label: 'Compare all' }, { value: 'single', label: 'By model' }]}
            />
          </div>
        </>
      )}

      {/* Lower content: comparison matrix (multi-run) or single-run detail */}
      {multipleRuns && groupView === 'compare'
        ? <MatrixView group={group} activeCaseIds={activeCaseIds} onSelectModel={openRun} />
        : selectedRun && <RunDetail key={selectedRun.id} run={selectedRun} activeCaseIds={activeCaseIds} />
      }
    </div>
  );
}
