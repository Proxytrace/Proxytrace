import {
  BeakerIcon,
  CpuIcon,
  ZapIcon,
} from '../../../components/icons';
import type { OptimizationProposalDto } from '../../../api/models';
import { ProposalKind } from '../../../api/models';
import { cn } from '../../../lib/cn';
import { agentColor } from '../../../lib/colors';
import { fmtRelative } from '../../../lib/format';
import {
  KIND_META,
  PRIORITY_META,
  TONE_BG_CLS,
  TONE_BG_SUBTLE_CLS,
  TONE_TEXT_CLS,
} from '../shared';
import type { DisplayStatus } from '../shared';

const KIND_ICON: Record<ProposalKind, React.ReactNode> = {
  [ProposalKind.SystemPrompt]: <BeakerIcon size={12}/>,
  [ProposalKind.Tool]:         <ZapIcon size={12}/>,
  [ProposalKind.ModelSwitch]:  <CpuIcon size={12}/>,
};

const KIND_HERO_ICON: Record<ProposalKind, React.ReactNode> = {
  [ProposalKind.SystemPrompt]: <BeakerIcon size={20}/>,
  [ProposalKind.Tool]:         <ZapIcon size={20}/>,
  [ProposalKind.ModelSwitch]:  <CpuIcon size={20}/>,
};

interface Props {
  dto: OptimizationProposalDto;
  status: DisplayStatus;
  titleLine: string;
}

export function ProposalHeader({ dto, status, titleLine }: Props) {
  const kind = KIND_META[dto.kind];
  const aColor = agentColor(dto.agentId);
  const prio = PRIORITY_META[dto.priority];

  return (
    <div className="flex items-start gap-3.5">
      <div
        className="size-11 rounded-lg flex items-center justify-center shrink-0"
        style={{
          background: `linear-gradient(135deg, color-mix(in srgb, ${kind.color} 20%, transparent), color-mix(in srgb, ${kind.color} 7%, transparent))`,
          border: `1px solid color-mix(in srgb, ${kind.color} 27%, transparent)`,
          color: kind.color,
          boxShadow: `0 0 24px color-mix(in srgb, ${kind.color} 13%, transparent)`,
        }}
      >
        {KIND_HERO_ICON[dto.kind]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          <span className="mono text-body-sm text-muted">{dto.id.slice(0, 8)}</span>
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
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2 py-[2px] text-caption font-semibold',
              TONE_BG_SUBTLE_CLS[status.tone],
              TONE_TEXT_CLS[status.tone],
            )}
          >
            <span
              className={cn(
                'inline-block size-1.5 rounded-full',
                TONE_BG_CLS[status.tone],
                status.pulse && 'pulse-dot',
              )}
            />
            {status.label}
          </span>
          <span className="text-body-sm text-muted">· {fmtRelative(dto.createdAt)}</span>
        </div>
        <h2 className="text-h1 font-bold text-primary leading-tight m-0 mb-1.5 tracking-[-0.01em]">
          {titleLine}
        </h2>
        <div className="flex items-center gap-2 flex-wrap text-body-sm">
          <span
            className="inline-flex items-center rounded-full px-2 py-[2px] font-medium mono"
            style={{
              background: `color-mix(in srgb, ${aColor} 14%, transparent)`,
              color: aColor,
            }}
          >
            {dto.agentName}
          </span>
          <span
            className="inline-flex items-center gap-1 font-medium"
            style={{ color: prio.color }}
          >
            <span className="inline-block size-1.5 rounded-full" style={{ background: prio.color }}/>
            {prio.label} priority
          </span>
          {dto.evidenceTestRunIds.length > 0 && (
            <span className="text-muted">· {dto.evidenceTestRunIds.length} evidence run{dto.evidenceTestRunIds.length !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>
    </div>
  );
}
