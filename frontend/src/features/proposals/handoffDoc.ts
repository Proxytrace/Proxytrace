// Pure handoff-document generation for promoted proposals. Proxytrace is an observing proxy —
// it cannot change the agent's actual system prompt / tools / model, which live in the client's
// code. Promoting a proposal therefore hands the change to a developer; this module renders the
// "apply this change" package they take away. No JSX, no I/O — unit-tested in handoffDoc.spec.ts.

import type { OptimizationProposalDto } from '../../api/models';
import { ProposalKind } from '../../api/models';
import { formatDeltaPt } from './validatedView';

/** The kind-specific text a "copy proposed change" button puts on the clipboard. */
export function proposedClipboardPayload(proposal: OptimizationProposalDto): string {
  const d = proposal.details;
  switch (d.kind) {
    case 'SystemPrompt': return d.proposedSystemMessage;
    case 'Tool': return JSON.stringify(d.proposedTools, null, 2);
    case 'ModelSwitch': return d.proposedModelName;
  }
}

/** Label for the kind-specific copy button. */
export const COPY_PAYLOAD_LABEL: Record<ProposalKind, string> = {
  [ProposalKind.SystemPrompt]: 'Copy proposed prompt',
  [ProposalKind.Tool]: 'Copy tools JSON',
  [ProposalKind.ModelSwitch]: 'Copy model name',
};

function pct(rate: number | null): string {
  return rate == null ? '—' : `${Math.round(rate * 100)}%`;
}

function changeSection(proposal: OptimizationProposalDto): string[] {
  const d = proposal.details;
  switch (d.kind) {
    case 'SystemPrompt':
      return [
        '## Proposed system prompt',
        '',
        'Replace the agent\'s system prompt with exactly the text below (adoption auto-detection matches it verbatim):',
        '',
        '```',
        d.proposedSystemMessage,
        '```',
        '',
        '<details><summary>Current system prompt (for reference)</summary>',
        '',
        '```',
        d.currentSystemMessage,
        '```',
        '',
        '</details>',
      ];
    case 'Tool':
      return [
        '## Proposed tool definitions',
        '',
        'Replace the agent\'s tool set with exactly the definitions below:',
        '',
        '```json',
        JSON.stringify(d.proposedTools, null, 2),
        '```',
      ];
    case 'ModelSwitch':
      return [
        '## Proposed model switch',
        '',
        `Switch the agent's model from \`${d.currentModelName}\` to \`${d.proposedModelName}\`.`,
      ];
  }
}

/**
 * The full markdown handoff document for a promoted proposal — what to change, why, and the
 * evidence behind it. Suitable for a ticket or PR description.
 */
export function buildHandoffMarkdown(proposal: OptimizationProposalDto): string {
  const delta = proposal.expectedPassRateDelta != null
    ? formatDeltaPt(Math.round(proposal.expectedPassRateDelta * 100))
    : null;

  const lines: string[] = [
    `# Apply optimization proposal — ${proposal.agentName}`,
    '',
    `- **Proposal:** \`${proposal.id}\``,
    `- **Kind:** ${proposal.kind}`,
    `- **Priority:** ${proposal.priority}`,
    '',
    '## Why',
    '',
    proposal.rationale,
    '',
    ...changeSection(proposal),
    '',
    '## Evidence (A/B validated)',
    '',
    `- Baseline pass rate: ${pct(proposal.currentPassRate)}`,
    `- Pass rate with this change: ${pct(proposal.proposedPassRate)}${delta ? ` (${delta})` : ''}`,
  ];

  if (proposal.abTestRun) {
    lines.push(`- A/B run: \`${proposal.abTestRun.id}\` (open in Proxytrace: /runs?run=${proposal.abTestRun.id})`);
  }

  lines.push(
    '',
    '## After applying',
    '',
    'Proxytrace watches the agent\'s live traffic and flips this proposal to **Adopted** when the',
    'change appears verbatim. Send the `X-Proxytrace-Agent` header with your calls so traffic is',
    'attributed to the right agent. If you applied a tweaked variant, use **Mark adopted** in the',
    'Proposals board instead.',
    '',
  );

  return lines.join('\n');
}
