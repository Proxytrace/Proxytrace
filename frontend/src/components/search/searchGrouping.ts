import { useMemo } from 'react';
import type { SearchHit, SearchKind } from '../../api/search';

/** Group a flat hit array by kind. */
export function groupHits(hits: SearchHit[]): Map<SearchKind, SearchHit[]> {
  const m = new Map<SearchKind, SearchHit[]>();
  for (const h of hits) {
    const arr = m.get(h.kind) ?? [];
    arr.push(h);
    m.set(h.kind, arr);
  }
  return m;
}

/** Flatten grouped hits in the given display order. */
export function flattenHits(
  groupOrder: { kind: SearchKind; label: string }[],
  grouped: Map<SearchKind, SearchHit[]>,
): SearchHit[] {
  return groupOrder.flatMap(g => grouped.get(g.kind) ?? []);
}

/** Compute start-index offsets for each group, for keyboard-navigation tracking. */
export function computeGroupOffsets(
  groupOrder: { kind: SearchKind; label: string }[],
  grouped: Map<SearchKind, SearchHit[]>,
): Map<SearchKind, number> {
  const offsets = new Map<SearchKind, number>();
  let c = 0;
  for (const g of groupOrder) {
    offsets.set(g.kind, c);
    c += (grouped.get(g.kind) ?? []).length;
  }
  return offsets;
}

/** Hook that memoizes the three derived grouping structures from hits + groupOrder. */
export function useGroupedHits(
  hits: SearchHit[],
  groupOrder: { kind: SearchKind; label: string }[],
) {
  const grouped = useMemo(() => groupHits(hits), [hits]);
  const flat = useMemo(() => flattenHits(groupOrder, grouped), [groupOrder, grouped]);
  const groupOffsets = useMemo(() => computeGroupOffsets(groupOrder, grouped), [groupOrder, grouped]);
  return { grouped, flat, groupOffsets };
}
