import { useLingui } from '@lingui/react/macro';
import { BeakerIcon, CpuIcon, ZapIcon } from '../../../components/icons';
import { ProposalKind } from '../../../api/models';
import { cn } from '../../../lib/cn';
import { KIND_META } from '../shared';

const KIND_ICON: Record<ProposalKind, React.ReactNode> = {
  [ProposalKind.SystemPrompt]: <BeakerIcon size={10} />,
  [ProposalKind.Tool]: <ZapIcon size={10} />,
  [ProposalKind.ModelSwitch]: <CpuIcon size={10} />,
};

// Kind → tinted tag classes (DESIGN tokens); mirrors KIND_META colors as leaf classes.
const KIND_PILL: Record<ProposalKind, string> = {
  [ProposalKind.SystemPrompt]:
    cn('bg-[color-mix(in_srgb,var(--accent-primary)_9%,transparent)] text-accent border-[color-mix(in_srgb,var(--accent-primary)_20%,transparent)]'),
  [ProposalKind.Tool]:
    cn('bg-[color-mix(in_srgb,var(--success)_9%,transparent)] text-success border-[color-mix(in_srgb,var(--success)_20%,transparent)]'),
  [ProposalKind.ModelSwitch]:
    cn('bg-[color-mix(in_srgb,var(--teal)_9%,transparent)] text-teal border-[color-mix(in_srgb,var(--teal)_20%,transparent)]'),
};

/** Tinted tag naming a proposal's kind (prompt rewrite / tool update / model swap). */
export function KindPill({ kind }: { kind: ProposalKind }) {
  const { i18n } = useLingui();
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-caption font-semibold', KIND_PILL[kind])}>
      {KIND_ICON[kind]} {i18n._(KIND_META[kind].label)}
    </span>
  );
}
