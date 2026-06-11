// Pure model for the validated-theory drawer view. No JSX, no I/O — unit-tested in
// validatedView.spec.ts. Once an A/B test has confirmed a theory, the drawer leads with the
// concrete change and its effective gain; this file derives both from the theory + proposal.

import type { OptimizationProposalDto, TheoryDto } from '../../api/models';
import { ProposalStatus } from '../../api/models';
import type { DisplayTone } from './shared';
import { passRateTransition } from './theoryBoard';

export interface GainSummary {
  /** Baseline pass rate in percent, when known. */
  fromPct: number | null;
  /** Achieved pass rate in percent. */
  toPct: number;
  /** Effective gain in percentage points, when the baseline is known. */
  deltaPt: number | null;
}

/** Effective gain of a validated theory — recorded theory metrics first, the A/B run summary as fallback. */
export function buildGainSummary(theory: TheoryDto, proposal: OptimizationProposalDto | null): GainSummary | null {
  const t = passRateTransition(theory);
  if (t) return { fromPct: t.fromPct, toPct: t.toPct, deltaPt: t.deltaPt };

  const ab = proposal?.abTestRun;
  if (ab && ab.completedCases > 0) {
    const toPct = Math.round(ab.passRate);
    const deltaPt = proposal.expectedPassRateDelta != null ? Math.round(proposal.expectedPassRateDelta * 100) : null;
    return { fromPct: deltaPt != null ? toPct - deltaPt : null, toPct, deltaPt };
  }
  return null;
}

/** "+12pt" / "−3pt" / "±0pt" display label for a gain delta. */
export function formatDeltaPt(deltaPt: number): string {
  if (deltaPt === 0) return '±0pt';
  return `${deltaPt > 0 ? '+' : '−'}${Math.abs(deltaPt)}pt`;
}

export interface ReviewMeta {
  label: string;
  tone: DisplayTone;
  description: string;
}

/** Review state of the proposal backing a validated theory. A missing proposal reads as Draft. */
export const REVIEW_META: Record<ProposalStatus, ReviewMeta> = {
  [ProposalStatus.Draft]: {
    label: 'Pending review',
    tone: 'teal',
    description: 'The change beat the baseline. Promote it to apply, or dismiss it.',
  },
  [ProposalStatus.Accepted]: {
    label: 'Promoted',
    tone: 'success',
    description: 'The change has been applied to the agent.',
  },
  [ProposalStatus.Rejected]: {
    label: 'Dismissed',
    tone: 'danger',
    description: 'A reviewer chose not to apply this change.',
  },
};
