import { ArrowUpRightIcon, BeakerIcon, CopyIcon } from '../../../components/icons';
import { ProposalStatus } from '../../../api/models';
import type { OptimizationProposalDto } from '../../../api/models';
import type { UseMutationResult } from '@tanstack/react-query';

interface Props {
  abReady: boolean;
  hasAbRun: boolean;
  updateStatus: UseMutationResult<OptimizationProposalDto, Error, ProposalStatus>;
}

export function ProposalActionBar({ abReady, hasAbRun, updateStatus }: Props) {
  return (
    <div className="flex gap-2 justify-end flex-wrap pt-3 mt-2 border-t border-hairline bg-surface">
      <button
        disabled={updateStatus.isPending}
        onClick={() => updateStatus.mutate(ProposalStatus.Rejected)}
        className="px-3.5 py-2 rounded-md text-body-sm font-medium text-muted bg-card-2 shadow-[var(--shadow-pill)] hover:text-secondary transition-colors disabled:opacity-50"
        data-write
      >
        Dismiss
      </button>
      <button
        className="px-4 py-2 rounded-md text-body-sm font-medium text-secondary bg-card shadow-[var(--shadow-pill)] inline-flex items-center gap-1.5 hover:text-primary transition-colors"
      >
        <CopyIcon size={12}/> Edit &amp; re-run
      </button>
      {!hasAbRun && (
        <button
          className="px-4 py-2 rounded-md text-body-sm font-semibold bg-card inline-flex items-center gap-1.5 border transition-colors"
          style={{
            color: 'var(--teal)',
            borderColor: 'color-mix(in srgb, var(--teal) 25%, transparent)',
            boxShadow: '0 1px 0 rgba(255,255,255,0.02) inset, 0 4px 14px -8px color-mix(in srgb, var(--teal) 40%, transparent)',
          }}
        >
          <BeakerIcon size={12}/> Run A/B test
        </button>
      )}
      <button
        disabled={updateStatus.isPending}
        onClick={() => updateStatus.mutate(ProposalStatus.Accepted)}
        className="px-4 py-2 rounded-md text-body-sm font-semibold text-white inline-flex items-center gap-1.5 disabled:opacity-50"
        style={{
          background: abReady ? 'var(--grad-success)' : 'var(--grad-accent)',
          boxShadow: abReady ? 'var(--shadow-btn-success)' : 'var(--shadow-btn)',
        }}
        data-write
      >
        <ArrowUpRightIcon size={12}/> {abReady ? 'Promote' : 'Apply now'}
      </button>
    </div>
  );
}
