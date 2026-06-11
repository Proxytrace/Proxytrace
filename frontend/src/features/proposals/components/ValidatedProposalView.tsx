import { Link } from 'react-router-dom';
import { ArrowUpRightIcon, ExternalLinkIcon, ResetIcon } from '../../../components/icons';
import { Button } from '../../../components/ui/Button';
import { Collapsible } from '../../../components/ui/Collapsible';
import type { OptimizationProposalDto, TheoryDto } from '../../../api/models';
import { ProposalStatus } from '../../../api/models';
import { cn } from '../../../lib/cn';
import { KIND_META, TONE_SUBTLE_BG, TONE_TEXT } from '../shared';
import { THEORY_SOURCE_LABEL } from '../theoryMeta';
import { buildGainSummary, REVIEW_META } from '../validatedView';
import { AbTestHero } from '../AbTestHero';
import { ChangeSections } from './ChangeSections';
import { EvidenceList } from './EvidenceList';
import { GainHero } from './GainHero';

interface Props {
  theory: TheoryDto;
  proposal: OptimizationProposalDto | null;
  suiteName: string | undefined;
  onSetStatus: (status: ProposalStatus) => void;
  onReset: () => void;
  actionPending: boolean;
  resetPending: boolean;
}

/**
 * Drawer body for a theory the A/B test has validated: leads with the effective gain and the
 * concrete change to apply; the theory rationale, evidence, and A/B run detail stay available
 * behind a collapsed section.
 */
export function ValidatedProposalView({ theory, proposal, suiteName, onSetStatus, onReset, actionPending, resetPending }: Props) {
  const review = REVIEW_META[proposal?.status ?? ProposalStatus.Draft];
  const reviewable = proposal?.status === ProposalStatus.Draft;
  // A reset re-runs validation from scratch; refused server-side once a proposal is promoted, so
  // hide it there — the applied change cannot be un-applied by resetting.
  const canReset = proposal?.status !== ProposalStatus.Accepted;
  const gain = buildGainSummary(theory, proposal);

  return (
    <div className="flex flex-col gap-4" data-testid="validated-proposal">
      <GainHero gain={gain} pValue={theory.pValue} review={review} />

      <div className="flex items-center gap-2">
        {reviewable ? (
          <>
            <Button
              variant="success" size="sm" loading={actionPending}
              leftIcon={<ArrowUpRightIcon size={12} />}
              onClick={() => onSetStatus(ProposalStatus.Accepted)}
              data-testid="proposal-promote-btn"
            >
              Promote
            </Button>
            <Button
              variant="secondary" size="sm" disabled={actionPending}
              onClick={() => onSetStatus(ProposalStatus.Rejected)}
              data-testid="proposal-dismiss-btn"
            >
              Dismiss
            </Button>
          </>
        ) : (
          <p className="text-body-sm text-secondary m-0">{review.description}</p>
        )}
        {canReset && (
          <Button
            variant="ghost" size="sm" className="ml-auto"
            loading={resetPending} disabled={actionPending}
            leftIcon={<ResetIcon size={12} />}
            onClick={onReset}
            data-testid="proposal-reset-btn"
          >
            Reset to Proposed
          </Button>
        )}
      </div>

      <section className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-h2 font-semibold text-primary m-0">Proposed change</h3>
          <span className={cn('inline-flex items-center rounded-sm px-2 py-[2px] text-caption font-semibold', TONE_SUBTLE_BG['accent'], TONE_TEXT['accent'])}>
            {KIND_META[theory.kind].label}
          </span>
        </div>
        <ChangeSections details={theory.details} />
      </section>

      <Collapsible
        title={<span className="text-body-sm font-medium">Theory & A/B test details</span>}
        headerClassName="text-secondary hover:text-primary transition-colors py-1 cursor-pointer"
        contentClassName="flex flex-col gap-3 mt-2"
      >
        <div className="flex flex-col gap-1.5">
          <span className="text-caption text-muted">
            Submitted via {THEORY_SOURCE_LABEL[theory.source]} · validated against {suiteName ?? 'a suite'}
          </span>
          <p className="text-body text-secondary leading-relaxed m-0">{theory.rationale}</p>
        </div>
        {theory.evidenceTestRunIds.length > 0 && <EvidenceList ids={theory.evidenceTestRunIds} />}
        {proposal?.abTestRun ? (
          <AbTestHero ab={proposal.abTestRun} expectedPassRateDelta={proposal.expectedPassRateDelta} />
        ) : theory.abTestRunId ? (
          <Link
            to={`/runs?run=${theory.abTestRunId}`}
            className="inline-flex items-center gap-1 self-start text-body-sm text-secondary hover:text-primary transition-colors"
          >
            View A/B run <ExternalLinkIcon size={11} />
          </Link>
        ) : null}
      </Collapsible>
    </div>
  );
}
