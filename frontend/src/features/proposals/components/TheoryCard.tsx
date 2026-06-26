import { Trans, useLingui } from '@lingui/react/macro';
import { BeakerIcon, CpuIcon, PlayIcon, ZapIcon } from '../../../components/icons';
import { Card } from '../../../components/ui/Card';
import type { TheoryDto } from '../../../api/models';
import { ProposalKind } from '../../../api/models';
import { cn } from '../../../lib/cn';
import { KIND_META } from '../shared';
import { theoryShortId } from '../theoryBoard';
import { TheoryFooter } from './TheoryFooter';

interface Props {
  theory: TheoryDto;
  suiteName: string | undefined;
  onOpen: () => void;
  onPromote: () => void;
  isPromoting: boolean;
  onReject: () => void;
  isRejecting: boolean;
}

const KIND_ICON: Record<ProposalKind, React.ReactNode> = {
  [ProposalKind.SystemPrompt]: <BeakerIcon size={10} />,
  [ProposalKind.Tool]: <ZapIcon size={10} />,
  [ProposalKind.ModelSwitch]: <CpuIcon size={10} />,
};

// Kind → leaf Tailwind classes (DESIGN tokens), instead of threading the CSS-var color string
// into inline styles. accent-primary / success / teal mirror KIND_META.
const KIND_BAR: Record<ProposalKind, string> = {
  [ProposalKind.SystemPrompt]: cn('bg-accent'),
  [ProposalKind.Tool]: cn('bg-success'),
  [ProposalKind.ModelSwitch]: cn('bg-teal'),
};

const KIND_PILL: Record<ProposalKind, string> = {
  [ProposalKind.SystemPrompt]:
    cn('bg-[color-mix(in_srgb,var(--accent-primary)_9%,transparent)] text-accent border-[color-mix(in_srgb,var(--accent-primary)_20%,transparent)]'),
  [ProposalKind.Tool]:
    cn('bg-[color-mix(in_srgb,var(--success)_9%,transparent)] text-success border-[color-mix(in_srgb,var(--success)_20%,transparent)]'),
  [ProposalKind.ModelSwitch]:
    cn('bg-[color-mix(in_srgb,var(--teal)_9%,transparent)] text-teal border-[color-mix(in_srgb,var(--teal)_20%,transparent)]'),
};

export function TheoryCard({ theory, suiteName, onOpen, onPromote, isPromoting, onReject, isRejecting }: Props) {
  const { i18n } = useLingui();
  const kind = KIND_META[theory.kind];
  const evidenceCount = theory.evidenceTestRunIds.length;

  return (
    <Card
      elevation="raised"
      padding="none"
      interactive
      hoverGlow={kind.color}
      onClick={onOpen}
      data-testid={`theory-card-${theory.id}`}
      className="relative overflow-hidden shrink-0"
    >
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg ${KIND_BAR[theory.kind]}`} />

      <div className="pl-4 pr-3.5 py-3">
        {/* Kind + handle */}
        <div className="flex items-center gap-1.5 mb-2">
          <span className={`inline-flex items-center gap-1 rounded-sm px-2 py-[2px] text-caption font-semibold border ${KIND_PILL[theory.kind]}`}>
            {KIND_ICON[theory.kind]} {i18n._(kind.label)}
          </span>
          <span className="mono ml-auto text-caption text-muted" data-testid={`theory-handle-${theory.id}`}>
            {theoryShortId(theory.id)}
          </span>
        </div>

        {/* Rationale */}
        <div className="text-title font-medium leading-snug text-primary line-clamp-3 mb-2.5">
          {theory.rationale}
        </div>

        {/* Suite / evidence */}
        <div className="flex items-center gap-2 mb-2.5 text-caption">
          <span className="inline-flex items-center gap-1.5 min-w-0 text-secondary">
            <PlayIcon size={10} className="shrink-0 text-muted" />
            <span className="truncate">{suiteName ?? <Trans>Unassigned suite</Trans>}</span>
          </span>
          {evidenceCount > 0 && (
            <span className="mono ml-auto shrink-0 text-muted">{evidenceCount}×</span>
          )}
        </div>

        <TheoryFooter
          theory={theory}
          onPromote={onPromote}
          isPromoting={isPromoting}
          onReject={onReject}
          isRejecting={isRejecting}
        />
      </div>
    </Card>
  );
}
