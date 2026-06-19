// Pure logic for the optimization-theory pipeline board. No JSX, no I/O — unit-tested in
// theoryBoard.spec.ts. The column rendering and icons live in the components.

import { msg } from '@lingui/core/macro';
import type { MessageDescriptor } from '@lingui/core';
import type { TheoryDto } from '../../api/models';
import { TheoryStatus } from '../../api/models';
import type { DisplayTone } from './shared';

export interface ColumnMeta {
  status: TheoryStatus;
  label: MessageDescriptor;
  sublabel: MessageDescriptor;
  tone: DisplayTone;
}

/** Left-to-right pipeline order, matching the theory lifecycle. */
export const BOARD_COLUMNS: readonly ColumnMeta[] = [
  { status: TheoryStatus.Proposed, label: msg`Proposed`, sublabel: msg`Hypotheses awaiting a test`, tone: 'accent' },
  { status: TheoryStatus.Validating, label: msg`Validating`, sublabel: msg`A/B test in flight`, tone: 'teal' },
  { status: TheoryStatus.Validated, label: msg`Validated`, sublabel: msg`Confirmed — ready to ship`, tone: 'success' },
  { status: TheoryStatus.Invalidated, label: msg`Rejected`, sublabel: msg`Disproven by A/B`, tone: 'danger' },
] as const;

/** Groups theories into their pipeline column, preserving input order within each column. */
export function groupByColumn(theories: readonly TheoryDto[]): Record<TheoryStatus, TheoryDto[]> {
  const groups: Record<TheoryStatus, TheoryDto[]> = {
    [TheoryStatus.Proposed]: [],
    [TheoryStatus.Validating]: [],
    [TheoryStatus.Validated]: [],
    [TheoryStatus.Invalidated]: [],
  };
  for (const theory of theories) {
    groups[theory.status].push(theory);
  }
  return groups;
}

export interface BoardStats {
  /** Total number of theories on the board. */
  theories: number;
  /** Theories that have completed an A/B test (validated or rejected). */
  tested: number;
  /** Share of tested theories that were validated, 0–100, or null when none tested. */
  winRate: number | null;
  /** Sum of proven pass-rate gains across validated theories, in percentage points. */
  provenGainPt: number;
}

export function boardStats(theories: readonly TheoryDto[]): BoardStats {
  const validated = theories.filter(t => t.status === TheoryStatus.Validated);
  const rejected = theories.filter(t => t.status === TheoryStatus.Invalidated);
  const tested = validated.length + rejected.length;

  const provenGainPt = validated.reduce((sum, t) => {
    const delta = passRateDeltaPt(t);
    return sum + (delta != null && delta > 0 ? delta : 0);
  }, 0);

  return {
    theories: theories.length,
    tested,
    winRate: tested > 0 ? Math.round((validated.length / tested) * 100) : null,
    provenGainPt,
  };
}

/** Short, human-friendly theory handle, e.g. `thy_6c47`. */
export function theoryShortId(id: string): string {
  const hex = id.replace(/[^0-9a-f]/gi, '').slice(0, 4).toLowerCase();
  return `thy_${hex || '0000'}`;
}

export interface PassRateTransition {
  fromPct: number;
  toPct: number;
  deltaPt: number;
}

/** Baseline → projected pass-rate transition, or null when metrics are absent. */
export function passRateTransition(theory: TheoryDto): PassRateTransition | null {
  if (theory.baselinePassRate == null || theory.projectedPassRate == null) return null;
  const fromPct = Math.round(theory.baselinePassRate * 100);
  const toPct = Math.round(theory.projectedPassRate * 100);
  return { fromPct, toPct, deltaPt: toPct - fromPct };
}

/** Proven gain in percentage points for a validated theory, or null when unavailable. */
export function passRateDeltaPt(theory: TheoryDto): number | null {
  return passRateTransition(theory)?.deltaPt ?? null;
}

/** Significance level above which a difference is treated as sampling noise. */
export const NOISE_THRESHOLD = 0.05;

export function isInsideNoise(pValue: number | null): boolean {
  return pValue != null && pValue >= NOISE_THRESHOLD;
}

export function formatPValue(pValue: number): string {
  return `p=${pValue.toFixed(2)}`;
}
