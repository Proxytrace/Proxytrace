import { EmptyState } from '../../components/ui/EmptyState';
import { Pill } from '../../components/ui/Pill';
import { Skeleton } from '../../components/ui/Skeleton';
import type { TheoryDto } from '../../api/models';
import { KIND_META, TONE_COLOR } from './shared';
import { THEORY_SOURCE_LABEL, THEORY_STATUS_META } from './theoryMeta';
import { useTheories } from './hooks/useTheories';

interface TheoriesPanelProps {
  onViewProposal?: (proposalId: string) => void;
}

/**
 * Read-only view of the optimization-theory pipeline for the current project.
 * Theories are unproven hypotheses (from optimizers, you, or Tracey AI) that are
 * A/B-validated before becoming reviewable proposals.
 */
export function TheoriesPanel({ onViewProposal }: TheoriesPanelProps) {
  const { theories, isLoading } = useTheories();

  if (isLoading) {
    return <Skeleton className="h-24 w-full" />;
  }

  if (theories.length === 0) {
    return (
      <EmptyState
        title="No optimization theories yet"
        description="Theories appear here when an optimizer, you, or Tracey AI proposes a change to validate."
      />
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {theories.map((theory) => (
        <TheoryRow key={theory.id} theory={theory} onViewProposal={onViewProposal} />
      ))}
    </ul>
  );
}

function TheoryRow({ theory, onViewProposal }: { theory: TheoryDto; onViewProposal?: (id: string) => void }) {
  const status = THEORY_STATUS_META[theory.status];
  const kind = KIND_META[theory.kind];

  return (
    <li className="flex items-start gap-3 rounded-xl border border-border bg-card p-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Pill label={kind.label} color={kind.color} size="sm" />
          <Pill label={status.label} color={TONE_COLOR[status.tone]} size="sm" />
          <span className="text-[12px] text-muted">via {THEORY_SOURCE_LABEL[theory.source]}</span>
        </div>
        <p className="mt-1.5 truncate text-[13px] text-secondary">{theory.rationale}</p>
      </div>
      {theory.resultingProposalId && onViewProposal && (
        <button
          type="button"
          onClick={() => onViewProposal(theory.resultingProposalId as string)}
          className="shrink-0 text-[12px] font-semibold text-accent hover:underline"
        >
          View proposal
        </button>
      )}
    </li>
  );
}
