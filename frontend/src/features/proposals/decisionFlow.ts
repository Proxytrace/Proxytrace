// Pure model for the theory "decision flow" timeline shown in the detail drawer. No JSX, no I/O.
// Maps a theory (+ its resulting proposal, if any) to an ordered list of lifecycle stages with a
// state and a short status label. The component renders each stage's body by key.

import type { OptimizationProposalDto, TheoryDto } from '../../api/models';
import { ProposalStatus, TheoryStatus } from '../../api/models';
import type { DisplayTone } from './shared';

export type FlowStageKey = 'evidence' | 'theory' | 'abTest' | 'proposal' | 'outcome';

/** complete = happened & succeeded · current = active/awaiting · pending = not reached yet · rejected = ended negatively. */
export type FlowState = 'complete' | 'current' | 'pending' | 'rejected';

export interface FlowStage {
  key: FlowStageKey;
  title: string;
  statusLabel: string;
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

  const abTest: FlowStage = {
    key: 'abTest',
    title: 'A/B validation',
    ...(validated
      ? { state: 'complete' as const, statusLabel: 'Improvement confirmed' }
      : invalidated
        ? { state: 'rejected' as const, statusLabel: 'No improvement' }
        : validating
          ? { state: 'current' as const, statusLabel: 'In flight' }
          : { state: 'pending' as const, statusLabel: 'Not yet tested' }),
  };

  const proposalStage: FlowStage = {
    key: 'proposal',
    title: 'Proposal',
    ...(validated
      ? { state: 'complete' as const, statusLabel: 'Draft created' }
      : invalidated
        ? { state: 'rejected' as const, statusLabel: 'None generated' }
        : { state: 'pending' as const, statusLabel: 'Pending validation' }),
  };

  const outcome: FlowStage = { key: 'outcome', title: 'Outcome', ...outcomeState(status, proposal) };

  return [
    {
      key: 'evidence',
      title: 'Evidence',
      state: 'complete',
      statusLabel: hasEvidence
        ? `${theory.evidenceTestRunIds.length} failing run${theory.evidenceTestRunIds.length !== 1 ? 's' : ''}`
        : 'Submitted directly',
    },
    { key: 'theory', title: 'Theory', state: 'complete', statusLabel: 'Hypothesised' },
    abTest,
    proposalStage,
    outcome,
  ];
}

function outcomeState(status: TheoryStatus, proposal: OptimizationProposalDto | null): { state: FlowState; statusLabel: string } {
  if (status === TheoryStatus.Invalidated) {
    return { state: 'rejected', statusLabel: 'Auto-rejected by A/B' };
  }
  if (status === TheoryStatus.Validated) {
    switch (proposal?.status) {
      case ProposalStatus.Accepted: return { state: 'complete', statusLabel: 'Promoted' };
      case ProposalStatus.Rejected: return { state: 'rejected', statusLabel: 'Dismissed' };
      default: return { state: 'current', statusLabel: 'Pending review' };
    }
  }
  return { state: 'pending', statusLabel: 'Awaiting decision' };
}
