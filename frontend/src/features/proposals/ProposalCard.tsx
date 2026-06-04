import { BeakerIcon, CpuIcon, ZapIcon } from '../../components/icons';
import { Card } from '../../components/ui/Card';
import type { OptimizationProposalDto } from '../../api/models';
import { ProposalKind, TestRunStatus } from '../../api/models';
import { cn } from '../../lib/cn';
import { agentColor } from '../../lib/colors';
import { fmtRelative } from '../../lib/format';
import {
  KIND_META,
  TONE_TEXT,
  TONE_BG,
  TONE_SUBTLE_BG,
  deltaTone,
  displayStatus,
  formatCostDelta,
  formatLatencyDelta,
  formatPercentDelta,
  isTerminal,
  titleFromRationale,
} from './shared';

interface Props {
  dto: OptimizationProposalDto;
  isActive: boolean;
  onClick: () => void;
}

const KIND_ICON: Record<ProposalKind, React.ReactNode> = {
  [ProposalKind.SystemPrompt]: <BeakerIcon size={10}/>,
  [ProposalKind.Tool]:         <ZapIcon size={10}/>,
  [ProposalKind.ModelSwitch]:  <CpuIcon size={10}/>,
};

export function ProposalCard({ dto, isActive, onClick }: Props) {
  const kind = KIND_META[dto.kind];
  const status = displayStatus(dto);
  const aColor = agentColor(dto.agentId);
  const terminal = isTerminal(dto);
  const ab = dto.abTestRun;
  const isRunning = ab?.status === TestRunStatus.Running || ab?.status === TestRunStatus.Pending;
  const progress = ab && ab.totalCases > 0 ? ab.completedCases / ab.totalCases : 0;

  const passDelta   = dto.expectedPassRateDelta;
  const costDelta   = dto.details.kind === 'ModelSwitch' ? dto.details.expectedCostDelta : null;
  const latencyDelta = dto.details.kind === 'ModelSwitch' ? dto.details.expectedLatencyMs : null;

  return (
    <Card
      elevation="raised"
      padding="none"
      hoverGlow={kind.color}
      selected={isActive}
      interactive
      onClick={onClick}
      data-testid={`proposal-card-${dto.id}`}
      className={cn('relative overflow-hidden transition-[box-shadow,opacity]', terminal && 'opacity-70')}
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg"
        style={{ background: kind.color, opacity: terminal ? 0.4 : 1 }}
      />

      <div className="pl-4 pr-3.5 py-3">
        {/* Top: type + status */}
        <div className="flex items-center gap-1.5 mb-2">
          <span
            className="inline-flex items-center gap-1 rounded-sm px-2 py-[2px] text-caption font-semibold border"
            style={{
              background: `color-mix(in srgb, ${kind.color} 9%, transparent)`,
              color: kind.color,
              borderColor: `color-mix(in srgb, ${kind.color} 20%, transparent)`,
            }}
          >
            {KIND_ICON[dto.kind]} {kind.label}
          </span>
          <span
            data-testid={`proposal-status-${dto.id}`}
            className={cn('ml-auto inline-flex items-center gap-1.5 rounded-full px-2 py-[2px] text-caption font-semibold', TONE_SUBTLE_BG[status.tone], TONE_TEXT[status.tone])}
          >
            <span
              className={cn('inline-block size-1.5 rounded-full', TONE_BG[status.tone], status.pulse && 'pulse-dot')}
            />
            {status.label}
          </span>
        </div>

        {/* Title */}
        <div
          className={cn(
            'text-title font-semibold leading-snug line-clamp-2 mb-1.5',
            terminal ? 'text-secondary' : 'text-primary',
          )}
        >
          {titleFromRationale(dto.rationale)}
        </div>

        {/* Agent + arrow */}
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          <span
            className="inline-flex items-center rounded-full px-2 py-[1px] text-caption font-medium mono"
            style={{
              background: `color-mix(in srgb, ${aColor} 12%, transparent)`,
              color: aColor,
            }}
          >
            {dto.agentName}
          </span>
        </div>

        {/* Impact pills */}
        {(passDelta != null || costDelta != null || latencyDelta != null) && (
          <div className="flex gap-1 flex-wrap mb-2">
            {passDelta != null && (
              <ImpactPill label="pass" value={formatPercentDelta(passDelta)} tone={deltaTone(passDelta, false)}/>
            )}
            {costDelta != null && costDelta !== 0 && (
              <ImpactPill label="cost" value={formatCostDelta(costDelta)} tone={deltaTone(costDelta, true)}/>
            )}
            {latencyDelta != null && latencyDelta !== 0 && (
              <ImpactPill label="p50" value={formatLatencyDelta(latencyDelta)} tone={deltaTone(latencyDelta, true)}/>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 text-caption text-muted">
          <span className="truncate min-w-0">
            {dto.evidenceTestRunIds.length > 0
              ? `${dto.evidenceTestRunIds.length} evidence run${dto.evidenceTestRunIds.length !== 1 ? 's' : ''}`
              : 'No evidence runs'}
          </span>
          <span className="mono shrink-0">{fmtRelative(dto.createdAt)}</span>
        </div>

        {/* Running progress strip */}
        {isRunning && ab && (
          <div className="mt-2 h-[3px] bg-card-2 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,var(--teal),var(--accent-primary))]"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        )}
      </div>
    </Card>
  );
}

function ImpactPill({ label, value, tone }: { label: string; value: string; tone: ReturnType<typeof deltaTone> }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full px-2 py-[1px] text-caption font-semibold mono', TONE_SUBTLE_BG[tone], TONE_TEXT[tone])}
    >
      <span className="opacity-60 font-medium">{label}</span>
      {value}
    </span>
  );
}
