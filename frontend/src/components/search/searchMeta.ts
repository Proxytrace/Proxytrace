import type { SearchKind } from '../../api/search';

// ---------------------------------------------------------------------------
// Group ordering (the canonical display order for search result groups)
// ---------------------------------------------------------------------------

export const ALL_GROUPS: { kind: SearchKind; label: string }[] = [
  { kind: 'agent',     label: 'Agents' },
  { kind: 'testSuite', label: 'Test Suites' },
  { kind: 'agentCall', label: 'Traces' },
  { kind: 'testCase',  label: 'Test Cases' },
  { kind: 'evaluator', label: 'Evaluators' },
];

// ---------------------------------------------------------------------------
// Per-kind visual metadata
// ---------------------------------------------------------------------------

export type KindMeta = {
  label: string;
  /** CSS variable string, e.g. "var(--teal)" (the steel-blue info token) */
  accent: string;
};

export const KIND_META: Record<SearchKind, KindMeta> = {
  agent:     { label: 'Agent',      accent: 'var(--teal)' },
  testSuite: { label: 'Test Suite', accent: 'var(--success)' },
  agentCall: { label: 'Trace',      accent: 'var(--accent-primary)' },
  evaluator: { label: 'Evaluator',  accent: 'var(--warn)' },
  testCase:  { label: 'Test Case',  accent: 'var(--success)' },
};

// ---------------------------------------------------------------------------
// Conversation role colors
// ---------------------------------------------------------------------------

export const ROLE_COLOR: Record<string, string> = {
  system:    'var(--text-secondary)',
  user:      'var(--teal)',
  assistant: 'var(--accent-hover)',
  tool:      'var(--success)',
};

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested in searchMeta.spec.ts)
// ---------------------------------------------------------------------------

/** Truncate a string to n chars, appending ellipsis if needed. */
export function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

/**
 * Given `kinds` prop (optional filter) return the ordered group list.
 * Excludes testCase by default unless explicitly requested.
 */
export function resolveGroupOrder(
  kinds: SearchKind[] | undefined,
): { kind: SearchKind; label: string }[] {
  if (kinds && kinds.length > 0) {
    return ALL_GROUPS.filter(g => kinds.includes(g.kind));
  }
  return ALL_GROUPS.filter(g => g.kind !== 'testCase');
}

/**
 * Extract the base role name from a conversation message role string.
 * Handles synthetic roles like "expected (assistant)".
 */
export function baseRole(role: string): string {
  return role.replace(/^expected \(/, '').replace(/\)$/, '').toLowerCase();
}
