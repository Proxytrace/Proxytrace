import { useCallback, useMemo } from 'react';
import { useSelectedId } from '../../../hooks/useSelectedId';

interface StoredSelection {
  evalId: string | null;
  caseId: string | null;
}

const EMPTY: StoredSelection = { evalId: null, caseId: null };

function storageKeyFor(projectId: string | null): string | null {
  return projectId ? `evaluator-playground:selection:${projectId}` : null;
}

function read(key: string | null): StoredSelection {
  if (!key) return EMPTY;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<StoredSelection>;
    return { evalId: parsed.evalId ?? null, caseId: parsed.caseId ?? null };
  } catch {
    return EMPTY;
  }
}

function write(key: string | null, value: StoredSelection): void {
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* localStorage unavailable / over quota — selection just isn't remembered */
  }
}

/**
 * Playground selection that survives both reload (URL `?id=`/`?case=`) and
 * navigating away and back (per-project `localStorage`). The URL wins so deep
 * links and shares still work; otherwise the last browser selection is restored.
 * Entity ids only — nothing sensitive (BEST_PRACTICES §12.3).
 */
export function useStickyPlaygroundSelection(projectId: string | null) {
  const [urlEvalId, setUrlEvalId] = useSelectedId('id');
  const [urlCaseId, setUrlCaseId] = useSelectedId('case');
  const key = storageKeyFor(projectId);
  // Read once per project; after a select the URL holds the value, so the
  // cached read is only ever the mount-time fallback.
  const stored = useMemo(() => read(key), [key]);

  const evalId = urlEvalId ?? stored.evalId;
  // Only restore a stored case when it belongs to the restored evaluator — a
  // deep link to a different judge must not inherit an unrelated case.
  const caseId = urlCaseId ?? (stored.evalId === evalId ? stored.caseId : null);

  const selectEvaluator = useCallback(
    (id: string) => {
      setUrlEvalId(id, ['case']); // switching judge drops the stale case param
      write(key, { evalId: id, caseId: null });
    },
    [setUrlEvalId, key],
  );

  const selectCase = useCallback(
    (id: string) => {
      setUrlCaseId(id);
      write(key, { evalId, caseId: id });
    },
    [setUrlCaseId, key, evalId],
  );

  return { evalId, caseId, selectEvaluator, selectCase };
}
