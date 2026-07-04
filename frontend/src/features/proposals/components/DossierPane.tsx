import type { OptimizationProposalDto, TheoryDto } from '../../../api/models';
import { TheoryStatus } from '../../../api/models';
import { DossierActionBar, type DossierActions } from './DossierActionBar';
import { DossierHeader } from './DossierHeader';
import { InFlightDossier } from './InFlightDossier';
import { ProposalDossier } from './ProposalDossier';

interface Props extends DossierActions {
  theory: TheoryDto;
  proposal: OptimizationProposalDto | null;
  suiteName: string | undefined;
}

/**
 * The review desk's right pane: verdict header, the change + evidence body, and the pinned
 * decision bar. Column layout inside responds to the pane's own width (container queries),
 * not the viewport.
 */
export function DossierPane({ theory, proposal, suiteName, ...actions }: Props) {
  const inFlight = theory.status === TheoryStatus.Proposed || theory.status === TheoryStatus.Validating;
  return (
    <section
      className="@container flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg bg-card shadow-[var(--shadow-card)]"
      data-testid="dossier"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <DossierHeader theory={theory} proposal={proposal} suiteName={suiteName} />
        {inFlight ? <InFlightDossier theory={theory} /> : <ProposalDossier theory={theory} proposal={proposal} />}
      </div>
      <DossierActionBar theory={theory} proposal={proposal} {...actions} />
    </section>
  );
}
