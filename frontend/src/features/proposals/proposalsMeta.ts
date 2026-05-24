// Pure constants and helpers for the proposals feature.
// No JSX, no I/O — unit-tested in proposals.spec.ts.

import { ProposalKind } from '../../api/models';

/** Maps a ProposalKind to its display icon size. Used to select the right icon in components. */
export const KIND_ICON_SIZE: Record<ProposalKind, number> = {
  [ProposalKind.SystemPrompt]: 12,
  [ProposalKind.Tool]: 12,
  [ProposalKind.ModelSwitch]: 12,
};

/** Maps a ProposalKind to its hero icon size. */
export const KIND_HERO_ICON_SIZE: Record<ProposalKind, number> = {
  [ProposalKind.SystemPrompt]: 20,
  [ProposalKind.Tool]: 20,
  [ProposalKind.ModelSwitch]: 20,
};

export type DiffLine = { kind: 'same' | 'add' | 'del'; text: string };

/**
 * Produces a simple line-level diff between two multi-line strings.
 * Lines present in `after` but not `before` are additions; lines present
 * in `before` but not `after` are deletions; matching pairs are "same".
 */
export function buildPromptDiff(before: string, after: string): DiffLine[] {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  const beforeSet = new Set(beforeLines);
  const afterSet = new Set(afterLines);

  const rendered: DiffLine[] = [];
  let bi = 0;
  let ai = 0;

  while (bi < beforeLines.length || ai < afterLines.length) {
    const b = beforeLines[bi];
    const a = afterLines[ai];
    if (bi < beforeLines.length && ai < afterLines.length && b === a) {
      rendered.push({ kind: 'same', text: a });
      bi++;
      ai++;
    } else if (ai < afterLines.length && !beforeSet.has(a)) {
      rendered.push({ kind: 'add', text: a });
      ai++;
    } else if (bi < beforeLines.length && !afterSet.has(b)) {
      rendered.push({ kind: 'del', text: b });
      bi++;
    } else {
      if (bi < beforeLines.length) {
        rendered.push({ kind: 'same', text: b });
        bi++;
      }
      if (ai < afterLines.length) ai++;
    }
  }

  return rendered;
}
