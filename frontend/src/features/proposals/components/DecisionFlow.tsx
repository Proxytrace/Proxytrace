import { Link } from 'react-router-dom';
import { Trans, useLingui } from '@lingui/react/macro';
import { ArrowUpRightIcon, ExternalLinkIcon, ResetIcon } from '../../../components/icons';
import { Button } from '../../../components/ui/Button';
import type { OptimizationProposalDto, TheoryDto } from '../../../api/models';
import { ProposalStatus, TheoryStatus } from '../../../api/models';
import { cn } from '../../../lib/cn';
import { KIND_META, TONE_SUBTLE_BG, TONE_TEXT } from '../shared';
import { THEORY_SOURCE_LABEL } from '../theoryMeta';
import { buildDecisionFlow, type FlowStageKey } from '../decisionFlow';
import { formatPValue, isInsideNoise, passRateTransition, theoryShortId } from '../theoryBoard';
import { adoptionLabel } from '../validatedView';
import { FlowStep } from './FlowStep';
import { AbTestHero } from '../AbTestHero';
import { ChangeSections } from './ChangeSections';
import { EvidenceList } from './EvidenceList';
import { HandoffPanel } from './HandoffPanel';

interface Props {
  theory: TheoryDto;
  proposal: OptimizationProposalDto | null;
  suiteName: string | undefined;
  onSetStatus: (status: ProposalStatus) => void;
  onReset: () => void;
  actionPending: boolean;
  resetPending: boolean;
}

/** The detail drawer body: the theory's lifecycle as a top-to-bottom decision flow. */
export function DecisionFlow({ theory, proposal, suiteName, onSetStatus, onReset, actionPending, resetPending }: Props) {
  const stages = buildDecisionFlow(theory, proposal);

  return (
    <ol className="flex flex-col" data-testid="decision-flow">
      {stages.map((stage, i) => (
        <FlowStep
          key={stage.key}
          title={stage.title}
          statusLabel={stage.statusLabel}
          state={stage.state}
          isLast={i === stages.length - 1}
        >
          <StageBody
            stageKey={stage.key}
            theory={theory}
            proposal={proposal}
            suiteName={suiteName}
            onSetStatus={onSetStatus}
            onReset={onReset}
            actionPending={actionPending}
            resetPending={resetPending}
          />
        </FlowStep>
      ))}
    </ol>
  );
}

function StageBody({
  stageKey, theory, proposal, suiteName, onSetStatus, onReset, actionPending, resetPending,
}: { stageKey: FlowStageKey } & Props) {
  const { t, i18n } = useLingui();
  const sourceLabel = i18n._(THEORY_SOURCE_LABEL[theory.source]);
  switch (stageKey) {
    case 'evidence': {
      const suite = suiteName ?? t`a suite`;
      return theory.evidenceTestRunIds.length > 0 ? (
        <EvidenceList ids={theory.evidenceTestRunIds} />
      ) : (
        <p className="text-body-sm text-muted m-0">
          <Trans>Submitted via {sourceLabel} — no failing runs attached. Validated against {suite}.</Trans>
        </p>
      );
    }

    case 'theory':
      return (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2 text-caption">
            <span className={cn('inline-flex items-center rounded-sm px-2 py-[2px] font-semibold', TONE_SUBTLE_BG['accent'], TONE_TEXT['accent'])}>
              {i18n._(KIND_META[theory.kind].label)}
            </span>
            <span className="text-muted"><Trans>via {sourceLabel}</Trans></span>
          </div>
          <p className="text-body text-secondary leading-relaxed m-0">{theory.rationale}</p>
          <ChangeSections details={theory.details} />
        </div>
      );

    case 'abTest':
      return <AbTestBody theory={theory} proposal={proposal} />;

    case 'proposal':
      return <ProposalBody theory={theory} proposal={proposal} />;

    case 'outcome':
      return (
        <OutcomeBody
          theory={theory}
          proposal={proposal}
          onSetStatus={onSetStatus}
          onReset={onReset}
          actionPending={actionPending}
          resetPending={resetPending}
        />
      );
  }
}

function AbTestBody({ theory, proposal }: { theory: TheoryDto; proposal: OptimizationProposalDto | null }) {
  const { t } = useLingui();
  if (theory.status === TheoryStatus.Proposed) {
    return <p className="text-body-sm text-muted m-0"><Trans>The candidate change has not been benchmarked yet.</Trans></p>;
  }
  if (theory.status === TheoryStatus.Validating) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-body-sm text-secondary m-0"><Trans>Benchmarking the change against the current agent…</Trans></p>
        <div className="h-[3px] rounded-full overflow-hidden bg-card-2 indeterminate-bar" />
        {theory.abTestRunId && (
          <Link
            to={`/runs?run=${theory.abTestRunId}`}
            className="inline-flex items-center gap-1 self-start text-body-sm text-secondary hover:text-primary transition-colors"
          >
            <Trans>View A/B run</Trans> <ExternalLinkIcon size={11} />
          </Link>
        )}
      </div>
    );
  }
  if (proposal?.abTestRun) {
    return <AbTestHero ab={proposal.abTestRun} expectedPassRateDelta={proposal.expectedPassRateDelta} />;
  }

  // Validated/Invalidated without a detailed A/B run summary — fall back to the recorded metrics.
  const transition = passRateTransition(theory);
  const noiseLabel = theory.pValue != null && (isInsideNoise(theory.pValue) ? t`inside noise` : t`significant`);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2.5 rounded-md bg-card-2 px-3.5 py-2.5">
        {transition ? (
          <>
            <span className="mono text-h2 text-secondary">{transition.fromPct}%</span>
            <span className="text-muted">→</span>
            <span className={cn('mono text-h2 font-semibold', transition.deltaPt > 0 ? 'text-success' : 'text-secondary')}>{transition.toPct}%</span>
            {transition.deltaPt !== 0 && (
              <span className={cn('mono rounded-full px-2 py-[1px] text-body-sm font-semibold', transition.deltaPt > 0 ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger')}>
                {transition.deltaPt > 0 ? '+' : '−'}{Math.abs(transition.deltaPt)}pt
              </span>
            )}
          </>
        ) : (
          <span className="text-body-sm text-muted"><Trans>No pass-rate metrics recorded.</Trans></span>
        )}
        {theory.pValue != null && (
          <span className="mono ml-auto text-caption text-muted">
            {formatPValue(theory.pValue)} · {noiseLabel}
          </span>
        )}
      </div>
      {theory.abTestRunId && (
        <Link
          to={`/runs?run=${theory.abTestRunId}`}
          className="inline-flex items-center gap-1 self-start text-body-sm text-secondary hover:text-primary transition-colors"
        >
          <Trans>View A/B run</Trans> <ExternalLinkIcon size={11} />
        </Link>
      )}
    </div>
  );
}

function ProposalBody({ theory, proposal }: { theory: TheoryDto; proposal: OptimizationProposalDto | null }) {
  if (theory.status === TheoryStatus.Invalidated) {
    return <p className="text-body-sm text-muted m-0"><Trans>No proposal generated — the change did not beat the baseline.</Trans></p>;
  }
  if (theory.status === TheoryStatus.Validated) {
    return (
      <p className="text-body-sm text-secondary m-0">
        <Trans>A reviewable draft proposal{proposal ? ` (${theoryShortId(proposal.id).replace('thy_', 'prop_')})` : ''} was created from the winning A/B test.</Trans>
      </p>
    );
  }
  return <p className="text-body-sm text-muted m-0"><Trans>A proposal is created only once the A/B test shows an improvement.</Trans></p>;
}

function OutcomeBody({
  theory, proposal, onSetStatus, onReset, actionPending, resetPending,
}: {
  theory: TheoryDto;
  proposal: OptimizationProposalDto | null;
  onSetStatus: (s: ProposalStatus) => void;
  onReset: () => void;
  actionPending: boolean;
  resetPending: boolean;
}) {
  const context = outcomeContext(theory, proposal);
  const reviewable = theory.status === TheoryStatus.Validated && proposal?.status === ProposalStatus.Draft;
  // A reset re-runs validation from scratch; refused server-side once a proposal is promoted or
  // adopted, so hide it there.
  const terminal = theory.status === TheoryStatus.Validated || theory.status === TheoryStatus.Invalidated;
  const canReset = terminal
    && proposal?.status !== ProposalStatus.Accepted
    && proposal?.status !== ProposalStatus.Adopted;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-body-sm text-secondary m-0">{context}</p>
      {proposal && <HandoffPanel proposal={proposal} />}
      {reviewable && (
        <div className="flex gap-2">
          <Button
            variant="success" size="sm" loading={actionPending}
            leftIcon={<ArrowUpRightIcon size={12} />}
            onClick={() => onSetStatus(ProposalStatus.Accepted)}
            data-testid="flow-promote-btn"
          >
            <Trans>Promote</Trans>
          </Button>
          <Button
            variant="secondary" size="sm" disabled={actionPending}
            onClick={() => onSetStatus(ProposalStatus.Rejected)}
            data-testid="flow-dismiss-btn"
          >
            <Trans>Dismiss</Trans>
          </Button>
        </div>
      )}
      {canReset && (
        <div className="flex">
          <Button
            variant="ghost" size="sm" loading={resetPending} disabled={actionPending}
            leftIcon={<ResetIcon size={12} />}
            onClick={onReset}
            data-testid="flow-reset-btn"
          >
            <Trans>Reset to Proposed</Trans>
          </Button>
        </div>
      )}
    </div>
  );
}

function outcomeContext(theory: TheoryDto, proposal: OptimizationProposalDto | null): React.ReactNode {
  if (theory.status === TheoryStatus.Invalidated) {
    return <Trans>The A/B test found no improvement, so the theory was rejected automatically — no review needed.</Trans>;
  }
  if (theory.status === TheoryStatus.Validated) {
    if (proposal?.status === ProposalStatus.Accepted) return <Trans>Promoted — awaiting adoption in your agent.</Trans>;
    if (proposal?.status === ProposalStatus.Adopted) return <Trans>{adoptionLabel(proposal)} — the change is live in the agent.</Trans>;
    if (proposal?.status === ProposalStatus.Rejected) return <Trans>Dismissed — a reviewer chose not to apply this change.</Trans>;
    return <Trans>The change beat the baseline. Promote it to get the handoff package, or dismiss it.</Trans>;
  }
  return <Trans>No decision yet — validation must finish first.</Trans>;
}
