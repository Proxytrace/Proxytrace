import { ArrowUpRightIcon } from '../../../components/icons';
import { Button } from '../../../components/ui/Button';
import type { TheoryDto } from '../../../api/models';
import { TheoryStatus } from '../../../api/models';
import { cn } from '../../../lib/cn';
import { agentColor } from '../../../lib/colors';
import { THEORY_SOURCE_LABEL } from '../theoryMeta';
import { formatPValue, isInsideNoise, passRateTransition } from '../theoryBoard';

interface Props {
  theory: TheoryDto;
  onPromote: () => void;
  isPromoting: boolean;
}

/** Status-specific bottom row of a {@link TheoryCard}: agent, A/B progress, transition, or promote. */
export function TheoryFooter({ theory, onPromote, isPromoting }: Props) {
  // agentColor is a runtime, hash-derived color → inline style is the sanctioned use (DESIGN §6).
  const aColor = agentColor(theory.agentId);
  const agentPill = (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-[1px] text-caption font-medium mono"
      style={{ background: `color-mix(in srgb, ${aColor} 12%, transparent)`, color: aColor }}
    >
      <span className="size-1.5 rounded-full" style={{ background: aColor }} />
      {theory.agentName}
    </span>
  );

  if (theory.status === TheoryStatus.Proposed) {
    return (
      <div className="flex items-center gap-2">
        {agentPill}
        <span className="ml-auto text-caption text-muted">via {THEORY_SOURCE_LABEL[theory.source]}</span>
      </div>
    );
  }

  if (theory.status === TheoryStatus.Validating) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          {agentPill}
          <span className="ml-auto inline-flex items-center gap-1.5 text-caption text-teal">
            <span className="size-1.5 rounded-full bg-teal pulse-dot" /> A/B in flight
          </span>
        </div>
        <div className="h-[3px] rounded-full overflow-hidden bg-card-2 indeterminate-bar" />
      </div>
    );
  }

  // Validated / Rejected — both show the measured pass-rate transition.
  const t = passRateTransition(theory);
  const validated = theory.status === TheoryStatus.Validated;

  return (
    <div className="flex flex-col gap-2.5">
      {t && (
        <div className="flex items-center gap-2 mono text-caption">
          <span className={cn(validated ? 'text-secondary' : 'text-muted')}>{t.fromPct}%</span>
          <span className="text-muted">→</span>
          <span className={cn('font-semibold', validated ? 'text-success' : 'text-secondary')}>{t.toPct}%</span>
          {t.deltaPt !== 0 && (
            <span
              className={cn(
                'rounded-full px-1.5 py-[1px] font-semibold',
                t.deltaPt > 0 ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger',
              )}
            >
              {t.deltaPt > 0 ? '+' : '−'}{Math.abs(t.deltaPt)}pt
            </span>
          )}
        </div>
      )}

      {validated ? (
        <Button
          variant="success"
          size="sm"
          fullWidth
          loading={isPromoting}
          disabled={theory.resultingProposalId == null}
          leftIcon={<ArrowUpRightIcon size={12} />}
          onClick={(e) => { e.stopPropagation(); onPromote(); }}
          data-testid={`theory-promote-btn-${theory.id}`}
        >
          {isPromoting ? 'Promoting…' : 'Promote'}
        </Button>
      ) : (
        theory.pValue != null && (
          <span className="mono text-caption text-muted">
            {formatPValue(theory.pValue)} · {isInsideNoise(theory.pValue) ? 'inside noise' : 'significant'}
          </span>
        )
      )}
    </div>
  );
}
