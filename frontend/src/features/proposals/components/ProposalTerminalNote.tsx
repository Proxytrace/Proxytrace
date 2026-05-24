import { CheckboxIcon } from '../../../components/icons';
import { ProposalStatus } from '../../../api/models';
import type { OptimizationProposalDto } from '../../../api/models';
import { fmtRelative } from '../../../lib/format';

interface Props {
  dto: OptimizationProposalDto;
}

export function ProposalTerminalNote({ dto }: Props) {
  if (dto.status === ProposalStatus.Accepted) {
    return (
      <div className="px-3.5 py-3 rounded-md flex items-center gap-2.5 border bg-success-subtle border-[color-mix(in_srgb,var(--success)_20%,transparent)]">
        <div className="size-7 rounded-md flex items-center justify-center shrink-0 text-success bg-[color-mix(in_srgb,var(--success)_20%,transparent)]">
          <CheckboxIcon size={14}/>
        </div>
        <div>
          <div className="text-title font-semibold text-success">Promoted · {fmtRelative(dto.updatedAt)}</div>
          <div className="text-body-sm text-secondary mt-0.5">This change is now live for the {dto.agentName} agent.</div>
        </div>
      </div>
    );
  }

  if (dto.status === ProposalStatus.Rejected) {
    return (
      <div className="px-3.5 py-3 rounded-md flex items-center gap-2.5 bg-card-2/40">
        <div className="size-7 rounded-md flex items-center justify-center shrink-0 text-muted font-bold text-h2 bg-card-2">
          ×
        </div>
        <div>
          <div className="text-title font-semibold text-muted">Dismissed · {fmtRelative(dto.updatedAt)}</div>
          <div className="text-body-sm text-secondary mt-0.5">This proposal will not be applied.</div>
        </div>
      </div>
    );
  }

  return null;
}
