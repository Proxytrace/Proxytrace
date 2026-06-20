import { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { ArrowDownToLineIcon, CheckIcon, CopyIcon } from '../../../components/icons';
import { Button } from '../../../components/ui/Button';
import type { OptimizationProposalDto } from '../../../api/models';
import { ProposalStatus } from '../../../api/models';
import { useSetProposalStatus } from '../hooks/useSetProposalStatus';
import { buildHandoffMarkdown, COPY_PAYLOAD_LABEL, proposedClipboardPayload } from '../handoffDoc';
import { adoptionLabel } from '../validatedView';

interface Props {
  proposal: OptimizationProposalDto;
}

type CopyTarget = 'payload' | 'doc';

/**
 * Handoff package for a promoted proposal. Proxytrace only observes traffic — it cannot apply
 * the change to the client's agent code — so promotion hands the developer everything needed to
 * apply it, then adoption is auto-detected from live traffic (or confirmed via Mark adopted).
 */
export function HandoffPanel({ proposal }: Props) {
  const { t, i18n } = useLingui();
  const [copied, setCopied] = useState<CopyTarget | null>(null);
  const setStatus = useSetProposalStatus();

  if (proposal.status === ProposalStatus.Adopted) {
    return (
      <p className="text-body-sm text-success m-0" data-testid="proposal-adoption-summary">
        {i18n._(adoptionLabel(proposal))}
        {proposal.adoptedAt ? ` · ${new Date(proposal.adoptedAt).toLocaleString()}` : ''}
      </p>
    );
  }
  if (proposal.status !== ProposalStatus.Accepted) return null;

  function copy(target: CopyTarget, text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(target);
      setTimeout(() => setCopied(null), 1500);
    }).catch(() => { /* ignore */ });
  }

  function downloadDoc() {
    const blob = new Blob([buildHandoffMarkdown(proposal)], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    // eslint-disable-next-line lingui/no-unlocalized-strings -- DOM tag name
    const anchor = document.createElement('a');
    anchor.href = url;
    // eslint-disable-next-line lingui/no-unlocalized-strings -- download filename, not UI copy
    anchor.download = `proposal-handoff-${proposal.id.slice(0, 8)}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="flex flex-col gap-2.5 rounded-md bg-card-2 px-3.5 py-3" data-testid="proposal-handoff-panel">
      <p className="text-body-sm text-secondary m-0">
        <Trans>
          Apply this change in your agent's code — Proxytrace flips the proposal to Adopted when the
          exact change shows up in live traffic. Applied a tweaked variant? Mark it adopted manually.
        </Trans>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary" size="sm"
          leftIcon={copied === 'payload' ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
          onClick={() => copy('payload', proposedClipboardPayload(proposal))}
          data-testid="proposal-copy-change-btn"
        >
          {copied === 'payload' ? t`Copied` : i18n._(COPY_PAYLOAD_LABEL[proposal.kind])}
        </Button>
        <Button
          variant="secondary" size="sm"
          leftIcon={copied === 'doc' ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
          onClick={() => copy('doc', buildHandoffMarkdown(proposal))}
          data-testid="proposal-copy-doc-btn"
        >
          {copied === 'doc' ? t`Copied` : t`Copy handoff doc`}
        </Button>
        <Button
          variant="ghost" size="sm"
          leftIcon={<ArrowDownToLineIcon size={12} />}
          onClick={downloadDoc}
          data-testid="proposal-download-doc-btn"
        >
          <Trans>Download .md</Trans>
        </Button>
        <Button
          variant="success" size="sm" className="ml-auto"
          loading={setStatus.isPending}
          onClick={() => setStatus.mutate({ id: proposal.id, status: ProposalStatus.Adopted })}
          data-testid="proposal-mark-adopted-btn"
        >
          <Trans>Mark adopted</Trans>
        </Button>
      </div>
    </section>
  );
}
