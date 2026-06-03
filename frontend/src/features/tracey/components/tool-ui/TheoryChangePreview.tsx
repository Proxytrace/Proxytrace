import type { ProposalDetailsDto } from '../../../../api/models';

interface TheoryChangePreviewProps {
  details: ProposalDetailsDto;
}

/**
 * Concise, read-as-text preview of the change a theory proposes — a prompt excerpt, a model
 * swap, or a tool-set summary — picked by the details discriminator. Untrusted content (the
 * proposed prompt) is rendered as text only, never HTML (BEST_PRACTICES §12).
 */
export function TheoryChangePreview({ details }: TheoryChangePreviewProps) {
  if (details.kind === 'ModelSwitch') {
    return (
      <div className="flex items-center gap-2 text-body-sm" data-testid="tracey-theory-change">
        <span className="rounded-sm bg-card-2 px-1.5 py-0.5 font-mono text-muted">{details.currentModelName}</span>
        <span aria-hidden className="text-muted">→</span>
        <span className="rounded-sm bg-card-2 px-1.5 py-0.5 font-mono text-primary">{details.proposedModelName}</span>
      </div>
    );
  }

  if (details.kind === 'Tool') {
    const names = details.proposedTools.map((t) => t.name).join(', ');
    return (
      <div className="text-body-sm text-secondary" data-testid="tracey-theory-change">
        <span className="text-muted">Proposed tools ({details.proposedTools.length}): </span>
        <span className="font-mono text-primary">{names || '—'}</span>
      </div>
    );
  }

  return (
    <div data-testid="tracey-theory-change">
      <div className="mb-1 text-caption uppercase tracking-wide text-muted">Proposed system prompt</div>
      <pre className="line-clamp-4 whitespace-pre-wrap rounded-sm bg-card-2 p-2 font-mono text-body-sm text-secondary">
        {details.proposedSystemMessage}
      </pre>
    </div>
  );
}
