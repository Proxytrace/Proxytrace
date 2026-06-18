import { useMemo, useState } from 'react';
import type { AgentCallDto, TestSuiteDto } from '../../../api/models';

/**
 * Owns the staged edit buffer for a suite detail/editor: traces queued to add as cases, existing
 * cases queued to remove, and the staged evaluator set. Derives the dirty count. Caller resolves
 * `pendingAddTraceIds` to `AgentCallDto[]` via the agent's trace map. Lifted from the former
 * EditSuiteDialog so the master–detail panel and any future host share one implementation.
 */
export function useSuiteEditor(suite: TestSuiteDto) {
  const baselineEvaluatorIds = useMemo(() => new Set(suite.evaluators.map(e => e.id)), [suite]);

  const [pendingAddTraceIds, setPendingAddTraceIds] = useState<Set<string>>(new Set());
  const [pendingRemoveCaseIds, setPendingRemoveCaseIds] = useState<Set<string>>(new Set());
  const [stagedEvaluatorIds, setStagedEvaluatorIds] = useState<Set<string>>(new Set(baselineEvaluatorIds));

  const evaluatorsChanged =
    stagedEvaluatorIds.size !== baselineEvaluatorIds.size ||
    [...stagedEvaluatorIds].some(id => !baselineEvaluatorIds.has(id));

  const dirtyCount = pendingAddTraceIds.size + pendingRemoveCaseIds.size + (evaluatorsChanged ? 1 : 0);

  function toggleAddTrace(id: string) {
    setPendingAddTraceIds(prev => toggle(prev, id));
  }
  function toggleRemoveCase(id: string) {
    setPendingRemoveCaseIds(prev => toggle(prev, id));
  }
  function toggleEvaluator(id: string) {
    setStagedEvaluatorIds(prev => toggle(prev, id));
  }
  function reset() {
    setPendingAddTraceIds(new Set());
    setPendingRemoveCaseIds(new Set());
    setStagedEvaluatorIds(new Set(baselineEvaluatorIds));
  }

  function resolveAddTraces(traceById: Map<string, AgentCallDto>): AgentCallDto[] {
    return [...pendingAddTraceIds].map(id => traceById.get(id)).filter((t): t is AgentCallDto => t !== undefined);
  }

  return {
    baselineEvaluatorIds,
    pendingAddTraceIds,
    pendingRemoveCaseIds,
    stagedEvaluatorIds,
    evaluatorsChanged,
    dirtyCount,
    isDirty: dirtyCount > 0,
    toggleAddTrace,
    toggleRemoveCase,
    toggleEvaluator,
    resolveAddTraces,
    reset,
  };
}

function toggle(set: Set<string>, id: string): Set<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id); else next.add(id);
  return next;
}
