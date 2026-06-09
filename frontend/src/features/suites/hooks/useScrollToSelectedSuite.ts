import { useEffect, useRef } from 'react';

/**
 * Brings the URL-selected suite card on-screen once the grid has rendered, so a
 * refresh / shared `?id=` link lands on the chosen suite even when it sits below
 * the fold. Unlike the transient deep-link focus ([[useSuiteFocus]]) this neither
 * flashes a highlight nor clears the param — the selection is persistent. The
 * scroll is a one-shot DOM side-effect (per BEST_PRACTICES §4.1); a ref guards
 * it so re-renders don't re-scroll and the selection stays freely scrollable.
 */
export function useScrollToSelectedSuite(selectedId: string | null, ready: boolean): void {
  const scrolledTo = useRef<string | null>(null);

  useEffect(() => {
    if (!selectedId || !ready || scrolledTo.current === selectedId) return;
    const el = document.querySelector(`[data-testid="suite-card-${selectedId}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'auto', block: 'center' });
    scrolledTo.current = selectedId;
  }, [selectedId, ready]);
}
