import { ArrowUpRightIcon } from '../../../components/icons';
import { Button } from '../../../components/ui/Button';
import type { ProposalDetailsDto, OptimizationProposalDto, TheoryDto } from '../../../api/models';
import { ProposalStatus, TheoryStatus } from '../../../api/models';
import { cn } from '../../../lib/cn';
import { KIND_META, TONE_SUBTLE_BG, TONE_TEXT } from '../shared';
import { THEORY_SOURCE_LABEL } from '../theoryMeta';
import { buildDecisionFlow, type FlowStageKey } from '../decisionFlow';
import { formatPValue, isInsideNoise, passRateTransition, theoryShortId } from '../theoryBoard';
import { FlowStep } from './FlowStep';
import { AbTestHero } from '../AbTestHero';
import { EvidenceList } from './EvidenceList';
import { SystemPromptSection } from './PromptDiff';
import { ModelSwitchSection } from './ModelSwitchSection';
import { ToolUpdateSection } from './ToolUpdateSection';

interface Props {
  theory: TheoryDto;
  proposal: OptimizationProposalDto | null;
  suiteName: string | undefined;
  onSetStatus: (status: ProposalStatus) => void;
  actionPending: boolean;
}

/** The detail drawer body: the theory's lifecycle as a top-to-bottom decision flow. */
export function DecisionFlow({ theory, proposal, suiteName, onSetStatus, actionPending }: Props) {
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
            actionPending={actionPending}
          />
        </FlowStep>
      ))}
    </ol>
  );
}

function StageBody({
  stageKey, theory, proposal, suiteName, onSetStatus, actionPending,
}: { stageKey: FlowStageKey } & Props) {
  switch (stageKey) {
    case 'evidence':
      return theory.evidenceTestRunIds.length > 0 ? (
        <EvidenceList ids={theory.evidenceTestRunIds} />
      ) : (
        <p className="text-body-sm text-muted m-0">
          Submitted via {THEORY_SOURCE_LABEL[theory.source]} — no failing runs attached. Validated against {suiteName ?? 'a suite'}.
        </p>
      );

    case 'theory':
      return (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2 text-caption">
            <span className={cn('inline-flex items-center rounded-sm px-2 py-[2px] font-semibold', TONE_SUBTLE_BG['accent'], TONE_TEXT['accent'])}>
              {KIND_META[theory.kind].label}
            </span>
            <span className="text-muted">via {THEORY_SOURCE_LABEL[theory.source]}</span>
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
        <OutcomeBody theory={theory} proposal={proposal} onSetStatus={onSetStatus} actionPending={actionPending} />
      );
  }
}

function ChangeSections({ details }: { details: ProposalDetailsDto }) {
  if (details.kind === 'SystemPrompt') return <SystemPromptSection details={details} />;
  if (details.kind === 'ModelSwitch') return <ModelSwitchSection details={details} />;
  return <ToolUpdateSection details={details} />;
}

function AbTestBody({ theory, proposal }: { theory: TheoryDto; proposal: OptimizationProposalDto | null }) {
  if (theory.status === TheoryStatus.Proposed) {
    return <p className="text-body-sm text-muted m-0">The candidate change has not been benchmarked yet.</p>;
  }
  if (theory.status === TheoryStatus.Validating) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-body-sm text-secondary m-0">Benchmarking the change against the current agent…</p>
        <div className="h-[3px] rounded-full overflow-hidden bg-card-2 indeterminate-bar" />
      </div>
    );
  }
  if (proposal?.abTestRun) {
    return <AbTestHero ab={proposal.abTestRun} expectedPassRateDelta={proposal.expectedPassRateDelta} />;
  }

  // Validated/Invalidated without a detailed A/B run summary — fall back to the recorded metrics.
  const t = passRateTransition(theory);
  return (
    <div className="flex items-center gap-2.5 rounded-md bg-card-2 px-3.5 py-2.5">
      {t ? (
        <>
          <span className="mono text-h2 text-secondary">{t.fromPct}%</span>
          <span className="text-muted">→</span>
          <span className={cn('mono text-h2 font-semibold', t.deltaPt > 0 ? 'text-success' : 'text-secondary')}>{t.toPct}%</span>
          {t.deltaPt !== 0 && (
            <span className={cn('mono rounded-full px-2 py-[1px] text-body-sm font-semibold', t.deltaPt > 0 ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger')}>
              {t.deltaPt > 0 ? '+' : '−'}{Math.abs(t.deltaPt)}pt
            </span>
          )}
        </>
      ) : (
        <span className="text-body-sm text-muted">No pass-rate metrics recorded.</span>
      )}
      {theory.pValue != null && (
        <span className="mono ml-auto text-caption text-muted">
          {formatPValue(theory.pValue)} · {isInsideNoise(theory.pValue) ? 'inside noise' : 'significant'}
        </span>
      )}
    </div>
  );
}

function ProposalBody({ theory, proposal }: { theory: TheoryDto; proposal: OptimizationProposalDto | null }) {
  if (theory.status === TheoryStatus.Invalidated) {
    return <p className="text-body-sm text-muted m-0">No proposal generated — the change did not beat the baseline.</p>;
  }
  if (theory.status === TheoryStatus.Validated) {
    return (
      <p className="text-body-sm text-secondary m-0">
        A reviewable draft proposal{proposal ? ` (${theoryShortId(proposal.id).replace('thy_', 'prop_')})` : ''} was created from the winning A/B test.
      </p>
    );
  }
  return <p className="text-body-sm text-muted m-0">A proposal is created only once the A/B test shows an improvement.</p>;
}

function OutcomeBody({
  theory, proposal, onSetStatus, actionPending,
}: { theory: TheoryDto; proposal: OptimizationProposalDto | null; onSetStatus: (s: ProposalStatus) => void; actionPending: boolean }) {
  const context = outcomeContext(theory, proposal);
  const reviewable = theory.status === TheoryStatus.Validated && proposal?.status === ProposalStatus.Draft;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-body-sm text-secondary m-0">{context}</p>
      {reviewable && (
        <div className="flex gap-2">
          <Button
            variant="success" size="sm" loading={actionPending}
            leftIcon={<ArrowUpRightIcon size={12} />}
            onClick={() => onSetStatus(ProposalStatus.Accepted)}
            data-testid="flow-promote-btn"
          >
            Promote
          </Button>
          <Button
            variant="secondary" size="sm" disabled={actionPending}
            onClick={() => onSetStatus(ProposalStatus.Rejected)}
            data-testid="flow-dismiss-btn"
          >
            Dismiss
          </Button>
        </div>
      )}
    </div>
  );
}

function outcomeContext(theory: TheoryDto, proposal: OptimizationProposalDto | null): string {
  if (theory.status === TheoryStatus.Invalidated) {
    return 'The A/B test found no improvement, so the theory was rejected automatically — no review needed.';
  }
  if (theory.status === TheoryStatus.Validated) {
    if (proposal?.status === ProposalStatus.Accepted) return 'Promoted — the change has been applied to the agent.';
    if (proposal?.status === ProposalStatus.Rejected) return 'Dismissed — a reviewer chose not to apply this change.';
    return 'The change beat the baseline. Promote it to apply, or dismiss it.';
  }
  return 'No decision yet — validation must finish first.';
}
