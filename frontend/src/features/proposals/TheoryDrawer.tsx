import { useLingui } from '@lingui/react/macro';
import { Drawer } from '../../components/overlays/Drawer';
import type { OptimizationProposalDto, ProposalStatus, TheoryDto } from '../../api/models';
import { TheoryStatus } from '../../api/models';
import { KIND_META } from './shared';
import { theoryShortId } from './theoryBoard';
import { DecisionFlow } from './components/DecisionFlow';
import { ValidatedProposalView } from './components/ValidatedProposalView';

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
 * Right-side detail for a board card. While a theory is unproven the body is its full lifecycle
 * as a decision flow (evidence → theory → A/B validation → proposal → outcome); once the A/B
 * test validates it, the body leads with the concrete change and its effective gain instead.
 */
export function TheoryDrawer({ theory, proposal, suiteName, onSetStatus, onReset, actionPending, resetPending, onClose }: Props) {
  const { i18n } = useLingui();
  const body = { theory, proposal, suiteName, onSetStatus, onReset, actionPending, resetPending };
  return (
    <Drawer
      title={`${theoryShortId(theory.id)} · ${i18n._(KIND_META[theory.kind].label)}`}
      subtitle={theory.agentName}
      onClose={onClose}
    >
      {theory.status === TheoryStatus.Validated ? <ValidatedProposalView {...body} /> : <DecisionFlow {...body} />}
    </Drawer>
  );
}
