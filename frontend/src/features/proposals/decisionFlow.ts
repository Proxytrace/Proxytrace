// Pure model for the theory "decision flow" timeline shown in the detail drawer. No JSX, no I/O.
// Maps a theory (+ its resulting proposal, if any) to an ordered list of lifecycle stages with a
// state and a short status label. The component renders each stage's body by key.

import { msg, plural } from '@lingui/core/macro';
import type { MessageDescriptor } from '@lingui/core';
import type { OptimizationProposalDto, TheoryDto } from '../../api/models';
import { ProposalStatus, TheoryStatus } from '../../api/models';
import type { DisplayTone } from './shared';

export type FlowStageKey = 'evidence' | 'theory' | 'abTest' | 'proposal' | 'outcome';

/** complete = happened & succeeded · current = active/awaiting · pending = not reached yet · rejected = ended negatively. */
export type FlowState = 'complete' | 'current' | 'pending' | 'rejected';

export interface FlowStage {
  key: FlowStageKey;
  title: string;
  statusLabel: MessageDescriptor;
  state: FlowState;
}

export const FLOW_STATE_TONE: Record<FlowState, DisplayTone> = {
  complete: 'success',
  current: 'teal',
  pending: 'muted',
  rejected: 'danger',
};

export function buildDecisionFlow(theory: TheoryDto, proposal: OptimizationProposalDto | null): FlowStage[] {
  const { status } = theory;
  const validated = status === TheoryStatus.Validated;
  const invalidated = status === TheoryStatus.Invalidated;
  const validating = status === TheoryStatus.Validating;
  const hasEvidence = theory.evidenceTestRunIds.length > 0;
  // A manually-dismissed theory lands in Invalidated without ever running an A/B test, so it carries
  // no metrics — distinguish it from a theory the A/B test actually disproved.
  const hadAbTest = theory.pValue != null || theory.baselinePassRate != null;

  const abTest: FlowStage = {
    key: 'abTest',
    title: 'A/B validation',
    ...(validated
      ? { state: 'complete' as const, statusLabel: msg`Improvement confirmed` }
      : invalidated
        ? (hadAbTest
            ? { state: 'rejected' as const, statusLabel: msg`No improvement` }
            : { state: 'pending' as const, statusLabel: msg`Skipped` })
        : validating
          ? { state: 'current' as const, statusLabel: msg`In flight` }
          : { state: 'pending' as const, statusLabel: msg`Not yet tested` }),
  };

  const proposalStage: FlowStage = {
    key: 'proposal',
    title: 'Proposal',
    ...(validated
      ? { state: 'complete' as const, statusLabel: msg`Draft created` }
      : invalidated
        ? { state: 'rejected' as const, statusLabel: msg`None generated` }
        : { state: 'pending' as const, statusLabel: msg`Pending validation` }),
  };

  const outcome: FlowStage = { key: 'outcome', title: 'Outcome', ...outcomeState(theory, proposal) };

  return [
    {
      key: 'evidence',
      title: 'Evidence',
      state: 'complete',
      statusLabel: hasEvidence
        ? msg`${plural(theory.evidenceTestRunIds.length, { one: '# failing run', other: '# failing runs' })}`
        : msg`Submitted directly`,
    },
    { key: 'theory', title: 'Theory', state: 'complete', statusLabel: msg`Hypothesised` },
    abTest,
    proposalStage,
    outcome,
  ];
}

function outcomeState(theory: TheoryDto, proposal: OptimizationProposalDto | null): { state: FlowState; statusLabel: MessageDescriptor } {
  const { status } = theory;
  if (status === TheoryStatus.Invalidated) {
    // A theory dismissed by the user (no A/B metrics) wasn't auto-rejected by the test — say so.
    const hadAbTest = theory.pValue != null || theory.baselinePassRate != null;
    return hadAbTest
      ? { state: 'rejected', statusLabel: msg`Auto-rejected by A/B` }
      : { state: 'rejected', statusLabel: msg`Dismissed` };
  }
  if (status === TheoryStatus.Validated) {
    switch (proposal?.status) {
      case ProposalStatus.Accepted: return { state: 'current', statusLabel: msg`Awaiting adoption` };
      case ProposalStatus.Adopted: return { state: 'complete', statusLabel: msg`Adopted` };
      case ProposalStatus.Rejected: return { state: 'rejected', statusLabel: msg`Dismissed` };
      default: return { state: 'current', statusLabel: msg`Pending review` };
    }
  }
  return { state: 'pending', statusLabel: msg`Awaiting decision` };
}
