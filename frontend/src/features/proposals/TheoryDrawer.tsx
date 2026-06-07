import { Drawer } from '../../components/overlays/Drawer';
import type { OptimizationProposalDto, ProposalStatus, TheoryDto } from '../../api/models';
import { KIND_META } from './shared';
import { theoryShortId } from './theoryBoard';
import { DecisionFlow } from './components/DecisionFlow';

interface Props {
  theory: TheoryDto;
  proposal: OptimizationProposalDto | null;
  suiteName: string | undefined;
  onSetStatus: (status: ProposalStatus) => void;
  onReset: () => void;
  actionPending: boolean;
  resetPending: boolean;
  onClose: () => void;
}

/**
 * Right-side detail for a board card: the theory's full lifecycle as a decision flow —
 * evidence → theory → A/B validation → proposal → outcome.
 */
export function TheoryDrawer({ theory, proposal, suiteName, onSetStatus, onReset, actionPending, resetPending, onClose }: Props) {
  return (
    <Drawer
      title={`${theoryShortId(theory.id)} · ${KIND_META[theory.kind].label}`}
      subtitle={theory.agentName}
      onClose={onClose}
    >
      <DecisionFlow
        theory={theory}
        proposal={proposal}
        suiteName={suiteName}
        onSetStatus={onSetStatus}
        onReset={onReset}
        actionPending={actionPending}
        resetPending={resetPending}
      />
    </Drawer>
  );
}
